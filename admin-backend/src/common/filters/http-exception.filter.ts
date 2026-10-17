import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { requestStats } from '../../modules/system/system.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();

    // body-parser / express errors carry their own 4xx status (413 too large, 400 malformed JSON ...): keep it instead of a blanket 500
    const parserStatus = (exception as { status?: number; statusCode?: number; type?: string } | null)?.status ?? (exception as { statusCode?: number } | null)?.statusCode;
    const isClientError = !(exception instanceof HttpException) && typeof parserStatus === 'number' && parserStatus >= 400 && parserStatus < 500;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isClientError ? (parserStatus as number) : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : isClientError ? (parserStatus === 413 ? 'Payload too large' : 'Bad request') : 'Internal server error';

    if (status >= 500) requestStats.serverErrors++; else if (status >= 400) requestStats.clientErrors++;
    if (status >= 500) {
      this.logger.error(
        `[${req.method}] ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      message,
    });
  }
}
