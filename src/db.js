import Dexie from 'dexie'

export const db = new Dexie('WeddingFitTrackerDB')

db.version(2).stores({
  exercises: '++id, day',
  logs: 'id, date, exerciseName',
  measurements: '++id, date'
})

// Initialize with default exercises if empty
export const initializeDefaultExercises = async () => {
  const count = await db.exercises.count()
  if (count === 0) {
    const defaultExercises = [
      { day: 'Monday', name: 'Exercise 1', order: 0 },
      { day: 'Tuesday', name: 'Exercise 1', order: 0 },
      { day: 'Thursday', name: 'Exercise 1', order: 0 },
      { day: 'Friday', name: 'Exercise 1', order: 0 },
      { day: 'Sunday', name: 'Exercise 1', order: 0 }
    ]
    await db.exercises.bulkAdd(defaultExercises)
  }
}
