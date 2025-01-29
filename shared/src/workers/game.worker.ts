import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RabbitMQService } from '../services/rabbitmq.service';
import { RedisService, GameService } from '../services';
import { Game, Board, GameProcessingMessage, GameAnalysisMessage } from '../interfaces';

@Injectable()
export class GameWorker {
    private readonly GAME_QUEUE = 'game_processing';
    private readonly ANALYSIS_QUEUE = 'game_analysis';

    constructor(
        @InjectModel('games') private readonly gameModel: Model<Game>,
        @InjectModel('board') private readonly boardModel: Model<Board>,
        private readonly rabbitMQService: RabbitMQService,
        private readonly redisService: RedisService,
        private readonly gameService: GameService
    ) {
        this.initializeQueues();
    }

    private async initializeQueues() {
        this.rabbitMQService.assertQueue(this.GAME_QUEUE);
        this.rabbitMQService.assertQueue(this.ANALYSIS_QUEUE);
    }

    async processGameState(gameId: string) {
        try {
            // Get game from redis
            const game = await this.redisService.getGame(gameId);
            if (!game) {
                throw new Error(`Game ${gameId} not found in database`);
            }

            // Process minimum moves calculation
            const processingMessage: GameProcessingMessage = {
                type: 'CALCULATE_MINIMUM_MOVES',
                gameId,
                currentState: game.currentState
            };
            this.rabbitMQService.sendToQueue(this.GAME_QUEUE, processingMessage);

            // Process game analysis
            const analysisMessage: GameAnalysisMessage = {
                type: 'ANALYZE_GAME',
                gameId,
                moves: game.moves
            };
            this.rabbitMQService.sendToQueue(this.ANALYSIS_QUEUE, analysisMessage);

        } catch (error) {
            console.error(`Error processing game state for ${gameId}:`, error);
            throw error;
        }
    }

    async handleGameProcessing() {
        this.rabbitMQService.consume(this.GAME_QUEUE, async (message) => {
            const { type, gameId, currentState } = JSON.parse(message.content.toString());

            try {
                switch (type) {
                    case 'CALCULATE_MINIMUM_MOVES':
                        await this.gameService.calculateMinimumMoves(currentState, gameId);
                        break;
                    case 'ANALYZE_GAME':
                        await this.gameService.getAnalysis(gameId);
                        break;
                    default:
                        console.warn(`Unknown message type: ${type}`);
                }
            } catch (error) {
                console.error(`Error processing message:`, error);
            }
        });
    }

    private async calculateMinimumMoves(gameId: string, currentState: number[][]) {
        const minimumMoves = await this.calculateMinimumMovesAlgorithm(currentState);

        // Update in database first
        const updatedGame = await this.gameModel.findByIdAndUpdate(
            gameId,
            { minimumMovesRequired: minimumMoves },
            { new: true }
        );

        // Then update Redis if database update was successful
        if (updatedGame) {
            await this.redisService.setGame(gameId, updatedGame);
        }
    }
    calculateMinimumMovesAlgorithm(currentState: number[][]) {
        throw new Error('Method not implemented.');
    }
}