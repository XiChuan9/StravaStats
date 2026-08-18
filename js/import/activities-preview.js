export async function readActivitiesPreview(importStore) {
    const activities = await importStore.listActivities({ limit: 500 });
    const counts = new Map();
    for (const activity of activities) {
        counts.set(
            activity.sportCategory,
            (counts.get(activity.sportCategory) || 0) + 1
        );
    }
    return Object.freeze({
        total: activities.length,
        bySportCategory: Object.freeze(
            [...counts.entries()]
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([sportCategory, count]) => Object.freeze({
                    sportCategory,
                    count
                }))
        )
    });
}
