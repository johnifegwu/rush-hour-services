import { Model, Document } from 'mongoose';
import { IBaseRepository } from '../../interfaces/repository.interface';

export abstract class BaseMongoRepository<T extends Document> implements IBaseRepository<T> {
    constructor(protected readonly model: Model<T>) { }

    async create(item: Partial<T>): Promise<T> {
        const newItem = new this.model(item);
        return await newItem.save();
    }

    async findById(id: string): Promise<T | null> {
        return await this.model.findById(id);
    }

    async findAll(): Promise<T[]> {
        return await this.model.find();
    }

    async update(id: string, item: Partial<T>): Promise<T | null> {
        return await this.model.findByIdAndUpdate(id, item, { new: true });
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);
        return result !== null;
    }
}