/**
 * ui/notifications.js — Toast notification and task-tracking helpers.
 */

export function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), duration);
    }
}

export function updateTaskMd(action) {
    console.log(`[Task Update] ${action} completed`);
}
