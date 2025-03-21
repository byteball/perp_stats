import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class TradeDto {
  @IsString()
  @IsNotEmpty()
  aaAddress: string;

  @IsString()
  @IsNotEmpty()
  triggerUnit: string;

  @IsNumber()
  @Type(() => Number)
  mci: number;

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
  priceInReserve: number;

  @IsNumber()
  @Type(() => Number)
  timestamp: number;
}
