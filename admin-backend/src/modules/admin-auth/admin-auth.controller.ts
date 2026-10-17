import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AllowLimited } from '../../common/decorators/allow-limited.decorator';
import { AuthThrottle } from '../../common/decorators/throttle.decorator';
import { ADMIN_ROLES } from '../../common/policy/route-policy';
import { AdminAuthService, ReqCtx } from './admin-auth.service';

class AdminLoginDto { @IsEmail() @MaxLength(200) email!: string; @IsString() @MaxLength(200) password!: string; @IsOptional() @IsString() @MaxLength(24) otp?: string; @IsOptional() @IsString() @MaxLength(4096) captchaToken?: string }
class RefreshDto { @IsString() @MaxLength(200) refreshToken!: string }
class ChangePasswordDto { @IsString() @MaxLength(200) currentPassword!: string; @IsString() @MaxLength(200) newPassword!: string }
class CodeDto { @IsString() @MaxLength(24) code!: string }
class DisableDto { @IsString() @MaxLength(200) password!: string; @IsString() @MaxLength(24) code!: string }
class CreateAdminDto { @IsEmail() email!: string; @IsString() @MinLength(2) @MaxLength(80) name!: string; @IsString() @MaxLength(200) password!: string; @IsIn(ADMIN_ROLES as unknown as string[]) role!: string }
class UpdateAdminDto { @IsOptional() @IsString() @MaxLength(80) name?: string; @IsOptional() @IsIn(ADMIN_ROLES as unknown as string[]) role?: string; @IsOptional() @IsBoolean() isActive?: boolean; @IsOptional() @IsString() @MaxLength(200) password?: string; @IsOptional() @IsBoolean() resetTwoFactor?: boolean }

const ANY_ADMIN = () => Roles(...ADMIN_ROLES);
interface AdminReq { user: { id: string; role: string; sid: string }; ip?: string; headers: Record<string, string | string[] | undefined> }
const ctx = (req: AdminReq): ReqCtx => ({ ip: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });

/** Panel sign-in. Separate from the player /auth: tokens carry typ=admin / aud=kow-admin, are signed with a different secret and are checked against a live session row. */
@ApiTags('admin-auth')
@Controller('admin-auth')
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Public() @AuthThrottle() @HttpCode(200) @Post('login')
  @ApiOperation({ summary: 'Panel login (e-mail + password [+ captcha] [+ otp / recovery code when two-factor is on])' })
  login(@Req() req: AdminReq, @Body() dto: AdminLoginDto) { return this.service.login(dto.email, dto.password, dto.otp, dto.captchaToken, ctx(req)); }

  @Public() @AuthThrottle() @HttpCode(200) @Post('refresh')
  refresh(@Req() req: AdminReq, @Body() dto: RefreshDto) { return this.service.refresh(dto.refreshToken, ctx(req)); }

  @ApiBearerAuth() @ANY_ADMIN() @AllowLimited() @Get('me')
  me(@Req() req: AdminReq) { return this.service.me(req.user.id); }

  @ApiBearerAuth() @ANY_ADMIN() @AllowLimited() @HttpCode(200) @Post('logout')
  @ApiOperation({ summary: 'End THIS session (its id and refresh token die)' })
  logout(@Req() req: AdminReq) { return this.service.logout(req.user.sid); }

  @ApiBearerAuth() @ANY_ADMIN() @HttpCode(200) @Post('logout-all')
  @ApiOperation({ summary: 'End every session of this admin (all devices)' })
  logoutAll(@Req() req: AdminReq) { return this.service.logoutAll(req.user.id); }

  @ApiBearerAuth() @ANY_ADMIN() @AuthThrottle() @HttpCode(200) @Post('change-password')
  changePassword(@Req() req: AdminReq, @Body() dto: ChangePasswordDto) { return this.service.changePassword(req.user.id, req.user.sid, ctx(req), dto.currentPassword, dto.newPassword); }

  @ApiBearerAuth() @ANY_ADMIN() @AllowLimited() @HttpCode(200) @Post('2fa/setup')
  twoFactorSetup(@Req() req: AdminReq) { return this.service.twoFactorSetup(req.user.id); }

  @ApiBearerAuth() @ANY_ADMIN() @AllowLimited() @AuthThrottle() @HttpCode(200) @Post('2fa/enable')
  twoFactorEnable(@Req() req: AdminReq, @Body() dto: CodeDto) { return this.service.twoFactorEnable(req.user.id, req.user.sid, ctx(req), dto.code); }

  @ApiBearerAuth() @ANY_ADMIN() @AuthThrottle() @HttpCode(200) @Post('2fa/disable')
  twoFactorDisable(@Req() req: AdminReq, @Body() dto: DisableDto) { return this.service.twoFactorDisable(req.user.id, dto.password, dto.code, ctx(req)); }
}

/** Admin account management (the policy table limits it to owner / super_admin / developer). */
@ApiTags('admins')
@ApiBearerAuth()
@Controller('admins')
export class AdminsController {
  constructor(private readonly service: AdminAuthService) {}

  @Get() list() { return this.service.list(); }
  @Get('roles') roles() { return { roles: ADMIN_ROLES }; }
  @Post() create(@Req() req: AdminReq, @Body() dto: CreateAdminDto) { return this.service.create(req.user, dto); }
  @Patch(':id') update(@Req() req: AdminReq, @Param('id') id: string, @Body() dto: UpdateAdminDto) { return this.service.update({ id: req.user.id, role: req.user.role }, id, dto); }
}
