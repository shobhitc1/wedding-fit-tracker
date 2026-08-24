import { useState, useEffect } from 'react'
import { db } from './db.js'
import TodayLog from './pages/TodayLog'
import Settings from './pages/Settings'
import Comparison from './pages/Comparison'
import Measurements from './pages/Measurements'
import './App.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('today')
  const [exercises, setExercises] = useState({})
  const [logs, setLogs] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)

  // Load data from Dexie on mount
  useEffect(() => {
    const loadData = async () => {
      const exercisesData = await db.exercises.toArray()
      const logsData = await db.logs.toArray()
      const measurementsData = await db.measurements.toArray()

      const exercisesObj = {}
      exercisesData.forEach(ex => {
        if (!exercisesObj[ex.day]) exercisesObj[ex.day] = []
        exercisesObj[ex.day].push(ex)
      })

      setExercises(exercisesObj)
      setLogs(logsData)
      setMeasurements(measurementsData)
      setLoading(false)
    }

    loadData()
  }, [])

  const handleExercisesUpdate = async (updatedExercises) => {
    await db.exercises.clear()
    const toInsert = []
    Object.entries(updatedExercises).forEach(([day, dayExercises]) => {
      dayExercises.forEach((ex, idx) => {
        toInsert.push({ ...ex, day, order: idx })
      })
    })
    await db.exercises.bulkAdd(toInsert)
    setExercises(updatedExercises)
  }

  const handleLogSave = async (newLog) => {
    await db.logs.add(newLog)
    const updatedLogs = await db.logs.toArray()
    setLogs(updatedLogs)
  }

  const handleMeasurementSave = async (newMeasurement) => {
    await db.measurements.add(newMeasurement)
    const updatedMeasurements = await db.measurements.toArray()
    setMeasurements(updatedMeasurements)
  }

  if (loading) {
    return <div className="app" style={{ textAlign: 'center', paddingTop: '20px' }}>Loading...</div>
  }

  return (
    <div className="app">
      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          Today
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </button>
        <button
          className={`tab-button ${activeTab === 'measurements' ? 'active' : ''}`}
          onClick={() => setActiveTab('measurements')}
        >
          Measure
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'today' && <TodayLog exercises={exercises} logs={logs} onSave={handleLogSave} />}
        {activeTab === 'settings' && <Settings exercises={exercises} onUpdate={handleExercisesUpdate} />}
        {activeTab === 'trends' && <Comparison logs={logs} exercises={exercises} />}
        {activeTab === 'measurements' && <Measurements measurements={measurements} onSave={handleMeasurementSave} />}
      </div>
    </div>
  )
}
