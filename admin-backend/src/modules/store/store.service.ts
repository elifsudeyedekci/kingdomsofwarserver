import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { validateRewards } from '../grants/grant.service';

interface GetProductsOptions {
  page: number;
  limit: number;
  includeInactive?: boolean;
}

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts({ page, limit, includeInactive = false }: GetProductsOptions) {
    const skip = (page - 1) * limit;
    const where = includeInactive ? {} : { isActive: true };

    const [items, total] = await Promise.all([
      this.prisma.storeProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.storeProduct.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getProductById(id: string) {
    const product = await this.prisma.storeProduct.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`StoreProduct ${id} not found`);
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.priceUsd < 0) {
      throw new BadRequestException('priceUsd must be non-negative');
    }

    validateRewards(dto.contents as never);      // what a purchase delivers must be a valid reward bundle: { wallet, items, packs, bonuses, xp }
    return this.prisma.storeProduct.create({ data: dto });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.storeProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`StoreProduct ${id} not found`);

    if (dto.contents !== undefined) validateRewards(dto.contents as never);
    return this.prisma.storeProduct.update({ where: { id }, data: dto });
  }

  async toggleProduct(id: string) {
    const product = await this.getProductById(id);
    return this.prisma.storeProduct.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
  }

  async getWallet(userId: string) {
    const wallet = await this.prisma.playerWallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException(`Wallet not found for user ${userId}`);
    return wallet;
  }

  async adjustWallet(userId: string, dto: AdjustWalletDto) {
    const wallet = await this.getWallet(userId);

    // Guard against driving any currency below zero before writing
    const currencies: Array<keyof AdjustWalletDto> = [
      'gems',
      'coins',
      'chestKeys',
      'eventTokens',
      'bpXp',
    ];

    for (const key of currencies) {
      const delta = dto[key] ?? 0;
      if (delta < 0 && (wallet[key] as number) + delta < 0) {
        throw new BadRequestException(
          `Insufficient ${key}: current ${wallet[key]}, requested delta ${delta}`,
        );
      }
    }

    const data: Record<string, number> = {};
    for (const key of currencies) {
      if (dto[key] !== undefined) {
        data[key] = (wallet[key] as number) + (dto[key] as number);
      }
    }

    return this.prisma.playerWallet.update({ where: { userId }, data });
  }
}
