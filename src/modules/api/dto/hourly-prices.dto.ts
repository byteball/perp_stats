import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GetHourlyPricesQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Asset parameter is required' })
  asset: string;

  @IsString()
  @IsOptional()
  tzOffset?: string;
}

export class HourlyPriceResponseDto {
  timestamp: number;
  price: number;
}
