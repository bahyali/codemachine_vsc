let currentTaskId: string | undefined;
const completedTasks = new Set<string>();

export function setActiveTaskId(taskId?: string) {
    currentTaskId = taskId;
}

export function getActiveTaskId(): string | undefined {
    return currentTaskId;
}

export function markTaskCompleted(taskId: string) {
    completedTasks.add(taskId);
}

export function clearActiveTask() {
    currentTaskId = undefined;
}

export function isTaskCompleted(taskId: string): boolean {
    return completedTasks.has(taskId);
}
