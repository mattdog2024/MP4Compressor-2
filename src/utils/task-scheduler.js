/**
 * 任务调度器
 */
class TaskScheduler {
    constructor(concurrency = 2) {
        this.concurrency = concurrency;
        this.queue = [];
        this.active = new Map();
        this.completed = new Set();
        this.failed = new Set();
    }

    /**
     * 添加任务到队列
     */
    addTask(task) {
        this.queue.push({
            ...task,
            status: 'pending',
            progress: 0
        });
    }

    /**
     * 开始处理队列
     */
    async start(onProgress, onComplete, onError) {
        while (this.queue.length > 0 || this.active.size > 0) {
            // 启动新任务直到达到并发限制
            while (this.active.size < this.concurrency && this.queue.length > 0) {
                const task = this.queue.shift();

                if (this.completed.has(task.id) || this.failed.has(task.id)) {
                    continue;
                }

                this.active.set(task.id, task);

                // 执行任务
                this.executeTask(task, onProgress, onComplete, onError)
                    .then(() => {
                        this.active.delete(task.id);
                        this.completed.add(task.id);
                    })
                    .catch((error) => {
                        this.active.delete(task.id);
                        this.failed.add(task.id);
                        onError(task.id, error);
                    });
            }

            // 等待一段时间再检查
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 执行单个任务
     */
    async executeTask(task, onProgress, onComplete, onError) {
        // 这个方法将在主进程中通过IPC实现
        // 这里只是接口定义
        throw new Error('需要在主进程中实现');
    }

    /**
     * 获取所有任务状态
     */
    getTaskStatus() {
        return {
            pending: this.queue.length,
            active: this.active.size,
            completed: this.completed.size,
            failed: this.failed.size
        };
    }

    /**
     * 清空队列
     */
    clear() {
        this.queue = [];
        this.active.clear();
        this.completed.clear();
        this.failed.clear();
    }

    /**
     * 设置并发数
     */
    setConcurrency(n) {
        this.concurrency = Math.max(1, Math.min(2, n));
    }
}

module.exports = TaskScheduler;
