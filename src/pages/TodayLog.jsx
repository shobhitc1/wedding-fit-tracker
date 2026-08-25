import { useState, useEffect } from 'react'
import { db } from '../db.js'

export default function TodayLog({ exercises, logs, onSave }) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const today = new Date()
  const todayName = days[today.getDay()]
  const todayDateStr = today.toISOString().split('T')[0]

  const isRestDay = todayName === 'Wednesday' || todayName === 'Saturday'
  const todayExercises = exercises[todayName] || []

  const [sets, setSets] = useState({})
  const [daysUntilWedding, setDaysUntilWedding] = useState(0)
  const [saveTimer, setSaveTimer] = useState(null)

  // Calculate days until wedding (Nov 25)
  useEffect(() => {
    const weddingDate = new Date(2026, 10, 25) // Nov 25, 2026
    const today = new Date()
    const diff = weddingDate - today
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    setDaysUntilWedding(Math.max(0, days))
  }, [])

  // Load today's log or get last values
  useEffect(() => {
    const loadTodayData = async () => {
      const todayLog = await db.logs.where('date').equals(todayDateStr).toArray()
      
      if (todayLog.length > 0) {
        // Use today's data - reconstruct with exactly 3 sets per exercise
        const setsByExercise = {}
        todayLog.forEach(log => {
          if (!setsByExercise[log.exerciseName]) {
            setsByExercise[log.exerciseName] = {}
          }
          setsByExercise[log.exerciseName][log.setNum] = {
            weight: log.weight,
            reps: log.reps,
            done: log.done,
            setNum: log.setNum
          }
        })

        // Convert to array with exactly 3 sets
        const finalSets = {}
        Object.entries(setsByExercise).forEach(([exerciseName, setsByNum]) => {
          finalSets[exerciseName] = [1, 2, 3].map(setNum =>
            setsByNum[setNum] || { weight: 0, reps: 0, done: false, setNum }
          )
        })
        setSets(finalSets)
      } else {
        // Get last logged values for each exercise
        const newSets = {}
        for (const ex of todayExercises) {
          const lastLog = await db.logs.where('exerciseName').equals(ex.name).reverse().first()
          newSets[ex.name] = [
            { weight: lastLog?.weight || 0, reps: lastLog?.reps || 0, done: false, setNum: 1 },
            { weight: lastLog?.weight || 0, reps: lastLog?.reps || 0, done: false, setNum: 2 },
            { weight: lastLog?.weight || 0, reps: lastLog?.reps || 0, done: false, setNum: 3 }
          ]
        }
        setSets(newSets)
      }
    }

    if (todayExercises.length > 0) {
      loadTodayData()
    }
  }, [todayExercises, todayDateStr])

  // Auto-save on debounce
  useEffect(() => {
    if (saveTimer) clearTimeout(saveTimer)
    
    const timer = setTimeout(() => {
      saveCurrentLog()
    }, 1000)
    
    setSaveTimer(timer)

    return () => clearTimeout(timer)
  }, [sets])

  const handleWeightChange = (exerciseName, setNum, delta) => {
    setSets(prev => ({
      ...prev,
      [exerciseName]: prev[exerciseName].map(s =>
        s.setNum === setNum ? { ...s, weight: Math.max(0, s.weight + delta) } : s
      )
    }))
  }

  const handleRepsChange = (exerciseName, setNum, delta) => {
    setSets(prev => ({
      ...prev,
      [exerciseName]: prev[exerciseName].map(s =>
        s.setNum === setNum ? { ...s, reps: Math.max(0, s.reps + delta) } : s
      )
    }))
  }

  const handleToggleDone = (exerciseName, setNum) => {
    setSets(prev => {
      const updated = { ...prev }
      const exerciseSets = updated[exerciseName]
      const setIndex = exerciseSets.findIndex(s => s.setNum === setNum)
      
      if (setIndex !== -1) {
        const newSet = { ...exerciseSets[setIndex] }
        newSet.done = !newSet.done
        exerciseSets[setIndex] = newSet
      }
      
      return updated
    })
  }

  const saveCurrentLog = async () => {
    // Delete today's logs first to prevent duplicates
    await db.logs.where('date').equals(todayDateStr).delete()
    
    const logsToSave = []
    Object.entries(sets).forEach(([exerciseName, setSets]) => {
      setSets.forEach(set => {
        logsToSave.push({
          date: todayDateStr,
          exerciseName,
          setNum: set.setNum,
          weight: set.weight,
          reps: set.reps,
          done: set.done,
          timestamp: new Date().toISOString()
        })
      })
    })

    for (const log of logsToSave) {
      await onSave(log)
    }
  }

  if (isRestDay) {
    return (
      <div className="today-log-page">
        <div className="countdown-badge">
          <div className="countdown-label">Days to wedding</div>
          <div className="countdown-number">{daysUntilWedding} days</div>
        </div>
        <div className="rest-day-message">
          <h2>Rest Day</h2>
          <p>{todayName} is a rest day. Recover and prepare for tomorrow!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="today-log-page">
      <div className="countdown-badge">
        <div className="countdown-label">Days to wedding</div>
        <div className="countdown-number">{daysUntilWedding} days</div>
      </div>

      <div className="exercises-container">
        {todayExercises.map(exercise => (
          <div key={exercise.name} className="exercise-card">
            <div className="exercise-name">{exercise.name}</div>

            {sets[exercise.name] && sets[exercise.name].map(set => (
              <div 
                key={`${exercise.name}-set-${set.setNum}`} 
                className={`set-row ${set.done ? 'completed' : ''}`}
                style={{
                  opacity: set.done ? 0.5 : 1,
                  textDecoration: set.done ? 'line-through' : 'none'
                }}
              >
                <div className="set-label">Set {set.setNum}</div>

                <div className="controls-group">
                  <div className="control-pair">
                    <button
                      className="control-btn"
                      onClick={() => handleWeightChange(exercise.name, set.setNum, -1)}
                    >
                      −
                    </button>
                    <div className="value-display weight-display">{set.weight}kg</div>
                    <button
                      className="control-btn"
                      onClick={() => handleWeightChange(exercise.name, set.setNum, 1)}
                    >
                      +
                    </button>
                  </div>

                  <div className="control-pair">
                    <button
                      className="control-btn"
                      onClick={() => handleRepsChange(exercise.name, set.setNum, -1)}
                    >
                      −
                    </button>
                    <div className="value-display reps-display">{set.reps} reps</div>
                    <button
                      className="control-btn"
                      onClick={() => handleRepsChange(exercise.name, set.setNum, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  className={`checkbox-btn ${set.done ? 'done' : ''}`}
                  onClick={() => handleToggleDone(exercise.name, set.setNum)}
                >
                  ✓
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
