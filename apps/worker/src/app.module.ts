// apps/worker/src/worker.module.ts
import { Module } from '@nestjs/common';
import { MoveAnalysisConsumer } from './move-analysis.consumer';
import { MoveQualityConsumer } from './move-quality.consumer';
import { GameService } from 'shared/src/services/game.service';

@Module({
    providers: [MoveAnalysisConsumer, MoveQualityConsumer, GameService],
})
export class WorkerModule { }
