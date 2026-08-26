import { useState } from 'react'

export default function Settings({ exercises, onUpdate }) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const restDays = ['Wednesday', 'Saturday']

  const [editingDay, setEditingDay] = useState(null)
  const [newExerciseName, setNewExerciseName] = useState('')

  const handleAddExercise = (day) => {
    if (!newExerciseName.trim()) return

    const updated = { ...exercises }
    if (!updated[day]) updated[day] = []
    updated[day] = [...updated[day], { name: newExerciseName }]
    onUpdate(updated)
    setNewExerciseName('')
  }

  const handleRemoveExercise = (day, idx) => {
    const updated = { ...exercises }
    updated[day] = updated[day].filter((_, i) => i !== idx)
    onUpdate(updated)
  }

  const handleEditExerciseName = (day, idx, newName) => {
    const updated = { ...exercises }
    updated[day][idx] = { ...updated[day][idx], name: newName }
    onUpdate(updated)
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="settings-subtitle">Edit your exercises by day</p>
      <button
        style={{ background: '#d90000', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}
        onClick={async () => {
          const { db } = await import('../db.js')
          await db.logs.clear()
          alert('All logs cleared!')
        }}
      >
        ⚠️ Clear All Logged Data (one-time cleanup)
      </button>
      <div className="days-container">
        {days.map(day => {
          const dayExercises = exercises[day] || []
          const isRestDay = restDays.includes(day)

          return (
            <div key={day} className={`day-section ${isRestDay ? 'rest-day' : ''}`}>
              <div className="day-header">
                <h3>{day}</h3>
                {isRestDay && <span className="rest-badge">Rest Day</span>}
              </div>

              {isRestDay ? (
                <p className="rest-info">No exercises on this day</p>
              ) : (
                <>
                  <div className="exercises-list">
                    {dayExercises.map((ex, idx) => (
                      <div key={idx} className="exercise-item">
                        <input
                          type="text"
                          value={ex.name}
                          onChange={(e) => handleEditExerciseName(day, idx, e.target.value)}
                          className="exercise-input"
                          placeholder="Exercise name"
                        />
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveExercise(day, idx)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {editingDay === day ? (
                    <div className="add-exercise-form">
                      <input
                        type="text"
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                        placeholder="New exercise name"
                        className="exercise-input"
                      />
                      <button
                        className="add-btn"
                        onClick={() => {
                          handleAddExercise(day)
                          setEditingDay(null)
                        }}
                      >
                        Add
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => setEditingDay(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="add-exercise-btn"
                      onClick={() => setEditingDay(day)}
                    >
                      + Add Exercise
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
