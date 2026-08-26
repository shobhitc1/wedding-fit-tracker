import Dexie from 'dexie'

export const db = new Dexie('WeddingFitTrackerDB')

// Version 1: original schema
db.version(1).stores({
  exercises: '++id, day',
  logs: '++id, date, exerciseName',
  measurements: '++id, date'
})

// Version 2: drop the old logs table (can't change primary key in place)
db.version(2).stores({
  exercises: '++id, day',
  logs: null,
  measurements: '++id, date'
})

// Version 3: recreate logs table with new primary key
db.version(3).stores({
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
