// Type definitions based on schemas/todo_schema.json

export interface Task {
    id: string;
    description: string;
    status: 'pending' | 'done' | 'failed';
    dependencies?: string[];
    file_paths?: string[];
}

export interface Iteration {
    iteration_id: string;
    description?: string;
    status: 'pending' | 'in-progress' | 'completed';
    tasks?: Task[];
    iterations?: Iteration[];
}

export type TodoPlan = Iteration[];