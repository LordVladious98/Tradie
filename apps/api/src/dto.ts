import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, ValidateNested, MinLength, MaxLength, IsDateString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JobStatus, PaymentMethod } from '@prisma/client';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'Password must be 8+ chars with uppercase, lowercase, and a number';

export class RegisterOwnerDto {
  @IsString() @MinLength(1) @MaxLength(100) businessName: string;
  @IsEmail() @IsOptional() businessEmail?: string;
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsEmail() email: string;
  @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}

export class ForgotPasswordDto {
  @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) newPassword: string;
}

export class CreateStaffDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsEmail() email: string;
  @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) password: string;
}

export class UpdateStaffDto {
  @IsString() @MinLength(1) @MaxLength(100) @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

export class CreateCustomerDto {
  @IsString() @MinLength(1) @MaxLength(200) name: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @MaxLength(30) @IsOptional() phone?: string;
  @IsString() @MaxLength(500) @IsOptional() address?: string;
  @IsString() @MaxLength(2000) @IsOptional() notes?: string;
}

export class UpdateCustomerDto {
  @IsString() @MinLength(1) @MaxLength(200) @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @MaxLength(30) @IsOptional() phone?: string;
  @IsString() @MaxLength(500) @IsOptional() address?: string;
  @IsString() @MaxLength(2000) @IsOptional() notes?: string;
}

export class CreateJobDto {
  @IsString() customerId: string;
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsString() @MaxLength(5000) @IsOptional() description?: string;
  @IsString() @MaxLength(500) @IsOptional() siteAddress?: string;
  @IsDateString() @IsOptional() scheduledStart?: string;
  @IsDateString() @IsOptional() scheduledEnd?: string;
  @IsString() @IsOptional() assignedUserId?: string;
}

export class UpdateJobDto {
  @IsString() @MinLength(1) @MaxLength(200) @IsOptional() title?: string;
  @IsString() @MaxLength(5000) @IsOptional() description?: string;
  @IsString() @MaxLength(500) @IsOptional() siteAddress?: string;
  @IsDateString() @IsOptional() scheduledStart?: string;
  @IsDateString() @IsOptional() scheduledEnd?: string;
  @IsString() @IsOptional() assignedUserId?: string;
}

export class UpdateJobStatusDto {
  @IsEnum(JobStatus) status: JobStatus;
  @IsBoolean() @IsOptional() force?: boolean;
}

export class CreateJobNoteDto {
  @IsString() @MinLength(1) @MaxLength(5000) note: string;
}

export class LineItemDto {
  @IsString() @MinLength(1) @MaxLength(500) description: string;
  @IsNumber() @Min(0) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
}

export class CreateQuoteDto {
  @IsString() jobId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsNumber() @Min(0) @IsOptional() discountAmount?: number;
}

export class UpdateQuoteDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsNumber() @Min(0) @IsOptional() discountAmount?: number;
}

export class CreateInvoiceDto {
  @IsString() jobId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsNumber() @Min(0) @IsOptional() discountAmount?: number;
  @IsDateString() @IsOptional() dueDate?: string;
}

export class UpdateInvoiceDto {
  @IsDateString() @IsOptional() dueDate?: string;
}

export class MarkPaidDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsEnum(PaymentMethod) @IsOptional() method?: PaymentMethod;
  @IsDateString() @IsOptional() paidAt?: string;
}

export class UpdateBusinessDto {
  @IsString() @MinLength(1) @MaxLength(200) @IsOptional() name?: string;
  @IsString() @MaxLength(20) @IsOptional() abn?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @MaxLength(30) @IsOptional() phone?: string;
  @IsString() @MaxLength(500) @IsOptional() address?: string;
  @IsBoolean() @IsOptional() gstEnabled?: boolean;
  @IsNumber() @Min(0) @IsOptional() gstRate?: number;
}

export class VerifyAbnDto {
  @IsString() @MinLength(11) @MaxLength(11) abn: string;
}
