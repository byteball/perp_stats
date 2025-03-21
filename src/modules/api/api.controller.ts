import { Controller, Get, Logger, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiService } from './api.service';
import { GetHourlyPricesQueryDto, HourlyPriceResponseDto } from './dto/hourly-prices.dto';

@Controller('api')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(private readonly apiService: ApiService) {}

  @Get('lastWeek')
  async getLastWeekPrices(@Query() query: GetHourlyPricesQueryDto): Promise<HourlyPriceResponseDto[]> {
    try {
      this.logger.log(`Getting hourly prices for asset ${query.asset}`);
      return this.apiService.getLastWeekPrices(query.asset, Number(query.tzOffset));
    } catch (error) {
      this.logger.error(`Error in getHourlyPrices: ${error.message}`, error.stack);
      throw new HttpException(`Failed to retrieve hourly prices for asset ${query.asset}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('lastMonth')
  async getLastMonthPrices(@Query() query: GetHourlyPricesQueryDto): Promise<HourlyPriceResponseDto[]> {
    try {
      this.logger.log(`Getting hourly prices for asset ${query.asset}`);
      return this.apiService.getLastMonthPrices(query.asset);
    } catch (error) {
      this.logger.error(`Error in getHourlyPrices: ${error.message}`, error.stack);
      throw new HttpException(`Failed to retrieve hourly prices for asset ${query.asset}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
