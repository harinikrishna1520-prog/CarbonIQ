import { useEffect, useState } from 'react'
import './App.css'

const initialUsage = {
  electricity: 260,
  gas: 18,
  car: 520,
  flights: 1,
}
const nationalAverage = 650
const initialMonthlyGoal = 500
const usageStorageKey = 'carboniq.activity-estimates.v1'
const goalStorageKey = 'carboniq.monthly-goal.v1'

function loadSavedUsage() {
  try {
    const storedUsage = window.localStorage.getItem(usageStorageKey)
    const storedGoal = window.localStorage.getItem(goalStorageKey)
    let usage = initialUsage
    let monthlyGoal = initialMonthlyGoal

    if (storedUsage) {
      usage = JSON.parse(storedUsage)
      const isValidUsage = Object.keys(initialUsage).every((key) =>
        typeof usage[key] === 'number'
        && Number.isFinite(usage[key])
        && usage[key] >= 0,
      )
      if (!isValidUsage) {
        throw new Error('Saved estimates are invalid. Update your activity and save again.')
      }
    }

    if (storedGoal) {
      monthlyGoal = Number(storedGoal)
      if (!Number.isFinite(monthlyGoal) || monthlyGoal <= 0) {
        throw new Error('Saved monthly goal is invalid. Set a new goal and save again.')
      }
    }

    return { usage, monthlyGoal, saved: Boolean(storedUsage || storedGoal), error: '' }
  } catch (error) {
    return {
      usage: initialUsage,
      monthlyGoal: initialMonthlyGoal,
      saved: false,
      error: error.message || 'Could not load saved estimates from this browser.',
    }
  }
}

const categories = [
  { key: 'electricity', label: 'Electricity', unit: 'kWh / month', icon: '↯', color: 'mint' },
  { key: 'gas', label: 'Natural gas', unit: 'therms / month', icon: '♨', color: 'amber' },
  { key: 'car', label: 'Car travel', unit: 'km / month', icon: '↗', color: 'blue' },
  { key: 'flights', label: 'Flights', unit: 'short-haul return trips / year', icon: '✈', color: 'violet' },
]

const tipsByCategory = {
  electricity: 'Check whether your electricity provider offers a renewable energy plan.',
  gas: 'Review your heating schedule and thermostat settings to spot opportunities to use less energy.',
  car: 'Combine nearby errands or replace a short car trip with walking, cycling, or transit.',
  flights: 'For your next trip, compare rail alternatives or consider whether a remote meeting works.',
}

const formatNumber = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`

function App() {
  const [storedPreferences] = useState(loadSavedUsage)
  const [usage, setUsage] = useState(storedPreferences.usage)
  const [monthlyGoal, setMonthlyGoal] = useState(storedPreferences.monthlyGoal)
  const [saved, setSaved] = useState(storedPreferences.saved)
  const [saveError, setSaveError] = useState(storedPreferences.error)
  const [emissions, setEmissions] = useState({
    monthly: 0,
    electricity: 0,
    gas: 0,
    car: 0,
    flights: 0,
  })
  const [calculationError, setCalculationError] = useState('')
  const [isCalculating, setIsCalculating] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function calculateEmissions() {
      setIsCalculating(true)
      setCalculationError('')

      try {
        const response = await fetch('/api/emissions/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(usage),
          signal: controller.signal,
        })
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Could not calculate your emissions.')
        }

        setEmissions(result.data)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setCalculationError(error.message || 'Could not reach the emissions service.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCalculating(false)
        }
      }
    }

    calculateEmissions()
    return () => controller.abort()
  }, [usage])

  const total = emissions.monthly
  const share = (amount) => total === 0 ? 0 : Math.round((amount / total) * 100)
  const averageDifference = Math.round(Math.abs((total - nationalAverage) / nationalAverage) * 100)
  const goalProgress = Math.min(Math.round((total / monthlyGoal) * 100), 100)
  const maxCategoryEmission = Math.max(
    emissions.electricity,
    emissions.gas,
    emissions.car,
    emissions.flights,
  )
  const leadingCategory = categories.reduce((leading, category) =>
    emissions[category.key] > emissions[leading.key] ? category : leading,
  )
  const chartStep = Math.max(200, Math.ceil(maxCategoryEmission / 3 / 100) * 100)
  const chartMax = chartStep * 3
  const chartTicks = [chartMax, chartStep * 2, chartStep, 0]

  function updateUsage(key, value) {
    setUsage((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
    setSaved(false)
    setSaveError('')
  }

  function updateMonthlyGoal(value) {
    setMonthlyGoal(Math.max(1, Number(value) || 1))
    setSaved(false)
    setSaveError('')
  }

  function saveUsage() {
    try {
      window.localStorage.setItem(usageStorageKey, JSON.stringify(usage))
      window.localStorage.setItem(goalStorageKey, String(monthlyGoal))
      setSaved(true)
      setSaveError('')
    } catch (error) {
      setSaved(false)
      setSaveError(error.message || 'Could not save estimates in this browser.')
    }
  }

  function exportReport() {
    const rows = [
      ['Category', 'Activity', 'Unit', 'Monthly emissions (kg CO2e)'],
      ...categories.map((category) => [
        category.label,
        usage[category.key],
        category.unit,
        emissions[category.key].toFixed(2),
      ]),
      ['Total', '', '', emissions.monthly.toFixed(2)],
      ['Monthly goal', monthlyGoal, 'kg CO2e', ''],
      ['Estimate note', 'Simplified average emissions factors; for personal awareness, not formal reporting.', '', ''],
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `carboniq-footprint-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="CarbonIQ home">
          <span className="brand-mark"><span /></span>
          <span>carbon<span className="brand-light">iq</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><span className="nav-icon">◫</span> Overview</a>
          <a className="nav-item" href="#calculator"><span className="nav-icon">⌁</span> My footprint</a>
          <a className="nav-item" href="#insights"><span className="nav-icon">◷</span> Insights</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✳</div>
            <strong>Small steps add up.</strong>
            <p>Understand your impact, then make a change that sticks.</p>
            <a href="#calculator">Explore your footprint <span>→</span></a>
          </div>
          <button className="profile-button" type="button" aria-label="Profile for Alex Morgan">
            <span className="avatar">AM</span>
            <span className="profile-copy"><strong>Alex Morgan</strong><small>Personal account</small></span>
            <span className="profile-more">···</span>
          </button>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="topbar-right"><span className="live-dot" /> Personal dashboard <span className="topbar-divider" /> <button className="icon-button" aria-label="Notifications" type="button">♧</button></div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR IMPACT, MADE CLEAR</div>
              <h1>A lighter footprint<br /><span>starts with awareness.</span></h1>
              <p className="intro-copy">Your everyday choices shape your carbon story. Let’s see where you stand.</p>
            </div>
            <div className="period-control"><span className="calendar-icon">▦</span> This month <span className="chevron">⌄</span></div>
          </section>

          <section className="metrics-grid" aria-label="Emissions summary">
            <article className="metric-card primary-metric">
              <div className="metric-top"><span className="metric-label">YOUR MONTHLY FOOTPRINT</span><span className="metric-icon leaf-icon">♧</span></div>
              <div className="metric-value">{formatNumber(total)} <span>kg CO₂e</span></div>
              <div className="metric-foot"><span>Based on your entered activity</span></div>
              <div className="metric-decoration"><i /><i /><i /><i /><i /><i /><i /></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">VS. NATIONAL AVERAGE</span><span className="metric-icon compare-icon">⌁</span></div>
              <div className="metric-value">{averageDifference}<span className="value-unit">%</span><span className="value-context"> {total <= nationalAverage ? 'lower' : 'higher'}</span></div>
              <div className="metric-foot"><span>Compared with an estimated {nationalAverage} kg / month</span></div>
              <div className="progress-track"><div style={{ width: `${Math.min(total / nationalAverage * 100, 100)}%` }} /></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">YOUR MONTHLY GOAL</span><span className="metric-icon goal-icon">◎</span></div>
              <div className="metric-value goal-value"><input aria-label="Monthly carbon goal in kilograms CO2 equivalent" className="goal-input" type="number" min="1" step="25" value={monthlyGoal} onChange={(event) => updateMonthlyGoal(event.target.value)} /><span>kg CO₂e</span></div>
              <div className="metric-foot"><span className="goal-status">{total <= monthlyGoal ? 'Within your goal' : `${formatNumber(total - monthlyGoal)} kg over goal`}</span><span>·</span><span> {goalProgress}% of goal</span></div>
              <div className="progress-track goal-track"><div style={{ width: `${goalProgress}%` }} /></div>
            </article>
          </section>

          <section className="analysis-grid" id="insights">
            <article className="panel breakdown-panel">
              <div className="panel-heading">
                <div><div className="eyebrow small-eyebrow">WHERE IT COMES FROM</div><h2>Your emissions breakdown</h2></div>
                <button className="text-button" type="button" onClick={() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })}>Edit inputs <span>↗</span></button>
              </div>
              <div className="breakdown-total"><strong>{isCalculating ? '…' : formatNumber(total)}</strong><span>kg CO₂e this month</span></div>
              {calculationError && <p className="calculation-error" role="alert">{calculationError}</p>}
              <div className="bar-chart" aria-label="Monthly carbon emissions by category">
                <div className="chart-y-labels">{chartTicks.map((tick) => <span key={tick}>{formatNumber(tick)}</span>)}</div>
                <div className="chart-area">
                  <div className="chart-gridline one" /><div className="chart-gridline two" /><div className="chart-gridline three" /><div className="chart-gridline four" />
                  <div className="bars">
                    {[
                      { name: 'Electricity', value: emissions.electricity, color: 'bar-green' },
                      { name: 'Natural gas', value: emissions.gas, color: 'bar-amber' },
                      { name: 'Car travel', value: emissions.car, color: 'bar-blue' },
                      { name: 'Flights', value: emissions.flights, color: 'bar-violet' },
                    ].map((item) => (
                      <div className="bar-column" key={item.name}>
                        <div className={`bar ${item.color}`} style={{ height: `${Math.max(4, Math.min(item.value / chartMax * 100, 100))}%` }} title={`${formatNumber(item.value)} kg CO₂e`} />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chart-months"><span>Current month</span><span>Monthly total</span></div>
                </div>
              </div>
              <div className="legend">
                <span><i className="legend-dot dot-green" />Electricity <b>{share(emissions.electricity)}%</b></span>
                <span><i className="legend-dot dot-amber" />Natural gas <b>{share(emissions.gas)}%</b></span>
                <span><i className="legend-dot dot-blue" />Car travel <b>{share(emissions.car)}%</b></span>
                <span><i className="legend-dot dot-violet" />Flights <b>{share(emissions.flights)}%</b></span>
              </div>
            </article>

            <article className="panel insight-panel">
              <div className="insight-heading"><span className="sparkle-icon">✳</span><span className="eyebrow small-eyebrow">A LITTLE INSIGHT</span><span className="new-label">NEW</span></div>
              <h2>Start with {leadingCategory.label.toLowerCase()}.</h2>
              <p className="insight-copy">{total === 0
                ? 'Enter your monthly activity to see which category contributes most to your estimated footprint.'
                : <>{leadingCategory.label} is your largest category at <strong>{share(emissions[leadingCategory.key])}%</strong> of your estimated footprint. That makes it a practical place to focus.</>
              }</p>
              <div className="insight-divider" />
              <div className="tip-row"><span className="tip-icon">✧</span><p><strong>Try this:</strong> {tipsByCategory[leadingCategory.key]}</p></div>
              <a className="insight-link" href="#calculator">Adjust your activity <span>→</span></a>
              <div className="insight-decoration">✳</div>
            </article>
          </section>

          <section className="panel calculator-panel" id="calculator">
            <div className="panel-heading calculator-heading">
              <div><div className="eyebrow small-eyebrow">MAKE IT PERSONAL</div><h2>Your monthly activity</h2><p>Adjust your estimates to see how your footprint changes.</p></div>
              <div className="calculator-actions">
                <button className="export-button" type="button" onClick={exportReport} disabled={isCalculating || Boolean(calculationError)} aria-label="Export footprint as CSV">↓ <span>Export CSV</span></button>
                <button className={`save-button ${saved ? 'saved' : ''}`} type="button" onClick={saveUsage}>{saved ? '✓ Saved' : 'Save changes'}</button>
              </div>
            </div>
            {saveError && <p className="calculation-error" role="alert">{saveError}</p>}
            <div className="input-grid">
              {categories.map((category) => (
                <label className="activity-input" key={category.key}>
                  <span className={`activity-icon ${category.color}`}>{category.icon}</span>
                  <span className="activity-label"><strong>{category.label}</strong><small>{category.unit}</small></span>
                  <input aria-label={`${category.label}, ${category.unit}`} type="number" min="0" value={usage[category.key]} onChange={(event) => updateUsage(category.key, event.target.value)} />
                </label>
              ))}
            </div>
            <p className="estimate-note">Estimates use simplified average emissions factors and are intended for personal awareness, not formal reporting.</p>
          </section>
          <footer className="page-footer"><span>CarbonIQ <span className="footer-dot">·</span> Clarity for a changing climate</span><span>Estimates are stored only in this browser</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
