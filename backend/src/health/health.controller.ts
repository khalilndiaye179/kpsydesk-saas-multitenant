import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    const isHealthy = await this.healthService.checkDatabase();
    if (!isHealthy) {
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
