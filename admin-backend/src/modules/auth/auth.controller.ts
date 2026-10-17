import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GuestDto } from './dto/guest.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { AuthThrottle } from '../../common/decorators/throttle.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @AuthThrottle()
  @Post('register')
  @ApiOperation({ summary: 'Register a new player account' })
  async register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Public()
  @AuthThrottle()
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anonymous device sign-in (creates the guest account on first use)' })
  async guest(@Body() dto: GuestDto) {
    return this.service.guest(dto.guestId, dto.secret);
  }

  @Public()
  @AuthThrottle()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Request() req: { user: { id: string; profile?: { username: string } | null } }) {
    const username = req.user.profile?.username ?? '';
    return this.service.login(req.user.id, username);
  }

  @Public()
  @AuthThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.service.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @PlayerApi()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.service.logout(dto.refreshToken);
  }
}
