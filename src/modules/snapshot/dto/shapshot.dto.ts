import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SnapshotDto {
  @IsString()
  @IsNotEmpty()
  aaAddress: string;

  @IsString()
  @IsNotEmpty()
  asset: string;

  @IsOptional()
  isRealtime: number;

  @IsNumber()
  @Type(() => Number)
  usdPrice: number;

  @IsNumber()
  @Type(() => Number)
  timestamp: number;
}
