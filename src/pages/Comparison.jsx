```jsx
import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { db } from '../db.js'

export default function Comparison({ logs, exercises }) {
  const [editingLog, setEditingLog] = useState(null)
  const [editValues, setEditValues] = useState({})

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]

  const restDays = ['Wednesday', 'Saturday']

  // The app was started on Sunday, August 23, 2026.
  // Therefore Week 1 starts on this date.
  const START_DATE = new Date(2026, 7, 23) // August 23, 2026
  const END_DATE = new Date(2026, 10, 25) // November 25, 2026

  // ------------------------------------------------------------
  // Existing logged-data charts
  // ------------------------------------------------------------

  const groupedData = useMemo(() => {
    const grouped = {}

    logs.forEach(log => {
      if (!grouped[log.exerciseName]) {
        grouped[log.exerciseName] = {}
      }

      const logDate = new Date(log.date)
      const weekStart = new Date(logDate)

      weekStart.setDate(
        logDate.getDate() - logDate.getDay()
      )

      const weekKey = weekStart.toISOString().split('T')[0]

      if (!grouped[log.exerciseName][weekKey]) {
        grouped[log.exerciseName][weekKey] = []
      }

      grouped[log.exerciseName][weekKey].push(log)
    })

    return grouped
  }, [logs])

  const volumeData = useMemo(() => {
    const data = {}

    Object.entries(groupedData).forEach(([exerciseName, weeks]) => {
      data[exerciseName] = []

      Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([week, logsInWeek]) => {
          const totalVolume = logsInWeek.reduce(
            (sum, log) => sum + (log.weight * log.reps),
            0
          )

          data[exerciseName].push({
            week: week.split('-').slice(1).join('-'),
            volume: totalVolume
          })
        })
    })

    return data
  }, [groupedData])

  const chartData = useMemo(() => {
    if (Object.keys(volumeData).length === 0) {
      return []
    }

    const weeks = new Set()

    Object.values(volumeData).forEach(exWeeks => {
      exWeeks.forEach(item => weeks.add(item.week))
    })

    const sortedWeeks = Array.from(weeks).sort()

    return sortedWeeks.map(week => {
      const dataPoint = { week }

      Object.entries(volumeData).forEach(([exerciseName, exWeeks]) => {
        const weekData = exWeeks.find(w => w.week === week)
        dataPoint[exerciseName] = weekData?.volume || 0
      })

      return dataPoint
    })
  }, [volumeData])

  const percentageChange = useMemo(() => {
    const changes = []

    Object.entries(volumeData).forEach(([exerciseName, weeks]) => {
      if (weeks.length >= 2) {
        const lastWeek = weeks[weeks.length - 1]
        const prevWeek = weeks[weeks.length - 2]

        const change =
          prevWeek.volume === 0
            ? '0.0'
            : (
                ((lastWeek.volume - prevWeek.volume) /
                  prevWeek.volume) *
                100
              ).toFixed(1)

        changes.push({
          exercise: exerciseName,
          lastWeek: lastWeek.volume,
          prevWeek: prevWeek.volume,
          changePercent: change
        })
      }
    })

    return changes
  }, [volumeData])

  // ------------------------------------------------------------
  // Generate complete workout calendar
  // ------------------------------------------------------------

  const weeklyWorkoutPlan = useMemo(() => {
    const weeks = []

    let currentWeekStart = new Date(START_DATE)
    let weekNumber = 1

    while (currentWeekStart <= END_DATE) {
      const days = []

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + dayIndex)

        // Don't generate anything after the wedding date.
        if (date > END_DATE) {
          break
        }

        const dateString = date.toISOString().split('T')[0]
        const dayName = dayNames[date.getDay()]
        const isRestDay = restDays.includes(dayName)

        const dayExercises = isRestDay
          ? []
          : (exercises[dayName] || [])

        const exerciseRows = []

        dayExercises.forEach(exercise => {
          for (let setNum = 1; setNum <= 3; setNum++) {
            const existingLog = logs.find(
              log =>
                log.date === dateString &&
                log.exerciseName === exercise.name &&
                log.setNum === setNum
            )

            exerciseRows.push({
              date: dateString,
              day: dayName,
              exerciseName: exercise.name,
              setNum,
              weight: existingLog?.weight ?? '',
              reps: existingLog?.reps ?? '',
              done: existingLog?.done ?? false,
              log: existingLog || null
            })
          }
        })

        days.push({
          date: dateString,
          dayName,
          isRestDay,
          exercises: exerciseRows
        })
      }

      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(currentWeekStart.getDate() + 6)

      const displayEnd = weekEnd > END_DATE ? END_DATE : weekEnd

      weeks.push({
        weekNumber,
        startDate: currentWeekStart.toISOString().split('T')[0],
        endDate: displayEnd.toISOString().split('T')[0],
        days
      })

      currentWeekStart = new Date(currentWeekStart)
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
      weekNumber++
    }

    return weeks
  }, [logs, exercises])

  // ------------------------------------------------------------
  // Editing
  // ------------------------------------------------------------

  const handleEditLog = (row) => {
    setEditingLog(row)

    setEditValues({
      weight: row.weight === '' ? '' : row.weight,
      reps: row.reps === '' ? '' : row.reps
    })
  }

  const handleSaveEdit = async () => {
    if (!editingLog) return

    const weight =
      editValues.weight === ''
        ? 0
        : parseFloat(editValues.weight)

    const reps =
      editValues.reps === ''
        ? 0
        : parseFloat(editValues.reps)

    // If this row already exists in the database,
    // update it normally.
    if (editingLog.log) {
      await db.logs.update(editingLog.log.id, {
        weight,
        reps
      })
    } else {
      // If it was previously blank, create a new log entry.
      const logId = `${editingLog.date}-${editingLog.exerciseName}-${editingLog.setNum}`

      const logEntry = {
        id: logId,
        date: editingLog.date,
        exerciseName: editingLog.exerciseName,
        setNum: editingLog.setNum,
        weight,
        reps,
        done: false,
        timestamp: new Date().toISOString()
      }

      const existing = await db.logs.get(logId)

      if (existing) {
        await db.logs.update(logId, logEntry)
      } else {
        await db.logs.add(logEntry)
      }
    }

    setEditingLog(null)

    // Refresh the page so the new value appears everywhere.
    window.location.reload()
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00')

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short'
    })
  }

  const colors = [
    '#00d9a3',
    '#00a3d9',
    '#d9a300',
    '#a300d9',
    '#d90000'
  ]

  return (
    <div className="comparison-page">
      <h1>Your Progress</h1>

      {/* =====================================================
          VOLUME TREND
      ====================================================== */}

      <div className="chart-container">
        <h2>Volume Trend (Weight × Reps)</h2>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#333"
              />

              <XAxis
                dataKey="week"
                stroke="#888"
              />

              <YAxis stroke="#888" />

              <Tooltip
                contentStyle={{
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444'
                }}
              />

              <Legend />

              {Object.keys(volumeData).map(
                (exerciseName, idx) => (
                  <Line
                    key={exerciseName}
                    type="monotone"
                    dataKey={exerciseName}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                )
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="no-data">
            No logged workout data yet.
          </p>
        )}
      </div>

      {/* =====================================================
          WEEK OVER WEEK CHANGE
      ====================================================== */}

      <div className="table-container">
        <h2>Week-over-Week % Change</h2>

        {percentageChange.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Last Week</th>
                <th>Prev Week</th>
                <th>Change %</th>
              </tr>
            </thead>

            <tbody>
              {percentageChange.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.exercise}</td>

                  <td>
                    {Math.round(item.lastWeek)}
                  </td>

                  <td>
                    {Math.round(item.prevWeek)}
                  </td>

                  <td
                    className={
                      parseFloat(item.changePercent) > 0
                        ? 'up'
                        : 'down'
                    }
                  >
                    {parseFloat(item.changePercent) > 0
                      ? '+'
                      : ''}
                    {item.changePercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">
            Not enough data yet.
          </p>
        )}
      </div>

      {/* =====================================================
          COMPLETE WORKOUT CALENDAR
      ====================================================== */}

      <div className="planned-workouts">
        <div className="planned-workouts-header">
          <h2>Workout Plan</h2>
          <p>
            August 23 – November 25, 2026
          </p>
        </div>

        {weeklyWorkoutPlan.map(week => (
          <div
            key={week.weekNumber}
            className="week-section"
          >
            <div className="week-header">
              <div>
                <h2>
                  Week {week.weekNumber}
                </h2>

                <span>
                  {formatDate(week.startDate)} –{' '}
                  {formatDate(week.endDate)}
                </span>
              </div>
            </div>

            {week.days.map(day => (
              <div
                key={day.date}
                className={`day-section-trends ${
                  day.isRestDay ? 'rest-day-trends' : ''
                }`}
              >
                <div className="trends-day-header">
                  <div>
                    <h3>{day.dayName}</h3>
                    <span>
                      {formatDate(day.date)}
                    </span>
                  </div>

                  {day.isRestDay && (
                    <span className="trends-rest-badge">
                      REST DAY
                    </span>
                  )}
                </div>

                {day.isRestDay ? (
                  <div className="trends-rest-message">
                    Recovery day
                  </div>
                ) : day.exercises.length > 0 ? (
                  <div className="trends-table-wrapper">
                    <table className="data-table trends-table">
                      <thead>
                        <tr>
                          <th>Exercise</th>
                          <th>Set</th>
                          <th>Weight</th>
                          <th>Reps</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {day.exercises.map(row => (
                          <tr
                            key={`${row.exerciseName}-${row.setNum}`}
                            className={
                              row.done
                                ? 'logged-row'
                                : ''
                            }
                          >
                            <td>
                              {row.exerciseName}
                            </td>

                            <td>
                              {row.setNum}
                            </td>

                            <td>
                              {row.weight !== ''
                                ? `${row.weight} kg`
                                : '—'}
                            </td>

                            <td>
                              {row.reps !== ''
                                ? row.reps
                                : '—'}
                            </td>

                            <td>
                              <button
                                className="edit-log-btn"
                                onClick={() =>
                                  handleEditLog(row)
                                }
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="trends-no-exercises">
                    No exercises scheduled
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* =====================================================
          EDIT MODAL
      ====================================================== */}

      {editingLog && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>
              Edit {editingLog.exerciseName}
            </h3>

            <p className="edit-modal-subtitle">
              {editingLog.dayName ||
                editingLog.day}{' '}
              • Set {editingLog.setNum}
            </p>

            <div className="modal-content">
              <label>
                Weight (kg):

                <input
                  type="number"
                  step="0.1"
                  value={editValues.weight}
                  onChange={e =>
                    setEditValues({
                      ...editValues,
                      weight: e.target.value
                    })
                  }
                  className="modal-input"
                />
              </label>

              <label>
                Reps:

                <input
                  type="number"
                  value={editValues.reps}
                  onChange={e =>
                    setEditValues({
                      ...editValues,
                      reps: e.target.value
                    })
                  }
                  className="modal-input"
                />
              </label>
            </div>

            <div className="modal-buttons">
              <button
                className="save-btn"
                onClick={handleSaveEdit}
              >
                Save
              </button>

              <button
                className="cancel-btn"
                onClick={() =>
                  setEditingLog(null)
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```
