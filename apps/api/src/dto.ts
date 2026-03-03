import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, ValidateNested, MinLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { JobStatus, PaymentMethod } from '@prisma/client';

export class RegisterOwnerDto {
  @IsString() @MinLength(1) businessName: string;
  @IsEmail() @IsOptional() businessEmail?: string;
  @IsString() @MinLength(1) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class CreateStaffDto {
  @IsString() @MinLength(1) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) @IsOptional() password?: string;
}

export class UpdateStaffDto {
  @IsString() @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

export class CreateCustomerDto {
  @IsString() @MinLength(1) name: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateCustomerDto {
  @IsString() @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() notes?: string;
}

export class CreateJobDto {
  @IsString() customerId: string;
  @IsString() @MinLength(1) title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() siteAddress?: string;
  @IsDateString() @IsOptional() scheduledStart?: string;
  @IsDateString() @IsOptional() scheduledEnd?: string;
  @IsString() @IsOptional() assignedUserId?: string;
}

export class UpdateJobDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() siteAddress?: string;
  @IsDateString() @IsOptional() scheduledStart?: string;
  @IsDateString() @IsOptional() scheduledEnd?: string;
  @IsString() @IsOptional() assignedUserId?: string;
}

export class UpdateJobStatusDto {
  @IsEnum(JobStatus) status: JobStatus;
  @IsBoolean() @IsOptional() force?: boolean;
}

export class CreateJobNoteDto {
  @IsString() @MinLength(1) note: string;
}

export class LineItemDto {
  @IsString() @MinLength(1) description: string;
  @IsNumber() quantity: number;
  @IsNumber() unitPrice: number;
}

export class CreateQuoteDto {
  @IsString() jobId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsNumber() @IsOptional() discountAmount?: number;
}

export class UpdateQuoteDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsNumber() @IsOptional() discountAmount?: number;
}

export class CreateInvoiceDto {
  @IsString() jobId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) items: LineItemDto[];
  @IsNumber() @IsOptional() discountAmount?: number;
  @IsDateString() @IsOptional() dueDate?: string;
}

export class UpdateInvoiceDto {
  @IsDateString() @IsOptional() dueDate?: string;
}

export class MarkPaidDto {
  @IsNumber() amount: number;
  @IsEnum(PaymentMethod) @IsOptional() method?: PaymentMethod;
  @IsDateString() @IsOptional() paidAt?: string;
}

export class UpdateBusinessDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() abn?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsBoolean() @IsOptional() gstEnabled?: boolean;
  @IsNumber() @IsOptional() gstRate?: number;
}
