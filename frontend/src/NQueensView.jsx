import { useState, useRef, useCallback, useEffect } from 'react'

const POD_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function shortPod(podName) {
  if (!podName) return '?'
  const parts = podName.split('-')
  return parts.length >= 3 ? parts.slice(-2).join('-') : podName.slice(-8)
}

function usePodColors() {
  const mapRef = useRef({})
  return useCallback((podName) => {
    if (!mapRef.current[podName]) {
      const idx = Object.keys(mapRef.current).length % POD_COLORS.length
      mapRef.current[podName] = POD_COLORS[idx]
    }
    return mapRef.current[podName]
  }, [])
}

function Board({ board, count }) {
  return (
    <div className="board-wrap">
      <div className="board" style={{ gridTemplateColumns: `repeat(${board.length}, 1fr)` }}>
        {board.map((queenCol, row) =>
          Array.from({ length: board.length }, (_, col) => (
            <div key={`${row}-${col}`} className={`cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`}>
              {queenCol === col && <span className="queen">♛</span>}
            </div>
          ))
        )}
      </div>
      <p className="board-label">{board.length}-Queens 해 #{count.toLocaleString()}</p>
    </div>
  )
}

function SingleRequest() {
  const [n, setN] = useState('12')
  const [board, setBoard] = useState([])
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('idle')
  const [podInfo, setPodInfo] = useState(null)
  const esRef = useRef(null)
  const doneRef = useRef(false)
  const getPodColor = usePodColors()

  const start = useCallback(() => {
    const parsed = parseInt(n, 10)
    if (!parsed || parsed < 1 || parsed > 20) return
    esRef.current?.close()
    setBoard([])
    setCount(0)
    setStatus('running')
    setPodInfo(null)
    doneRef.current = false

    const es = new EventSource(`/api/nqueens?n=${parsed}`)
    esRef.current = es
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'info') setPodInfo({ pod: msg.pod, version: msg.version })
      if (msg.type === 'solution') { setBoard(msg.board); setCount(msg.count) }
      if (msg.type === 'progress') setCount(msg.count)
      if (msg.type === 'done') { doneRef.current = true; es.close(); setCount(msg.total); setStatus('done') }
    }
    es.onerror = () => { setTimeout(() => { if (!doneRef.current) setStatus('error') }, 100); es.close() }
  }, [n])

  const stop = useCallback(() => { esRef.current?.close(); setStatus('idle') }, [])
  useEffect(() => () => esRef.current?.close(), [])

  return (
    <div className="tab-content">
      {podInfo && (
        <div className="pod-info">
          <span className="pod-label">Pod</span>
          <span className="pod-name" title={podInfo.pod} style={{ color: getPodColor(podInfo.pod) }}>
            {shortPod(podInfo.pod)}
          </span>
          <span className={`version-badge version-${podInfo.version}`}>{podInfo.version}</span>
        </div>
      )}
      <div className="controls">
        <label className="n-input">
          <span>N =</span>
          <input type="number" value={n} min={1} max={20}
            disabled={status === 'running'} onChange={e => setN(e.target.value)} />
        </label>
        <button className="btn btn-start" onClick={start} disabled={status === 'running'}>시작</button>
        {status === 'running' && <button className="btn btn-stop" onClick={stop}>중지</button>}
        <div className="stats">
          {status === 'running' && <span className="label-active">진행중...</span>}
          {count > 0 && <span>해 발견: <strong>{count.toLocaleString()}</strong>개</span>}
          {status === 'done' && <span className="label-done">완료! 총 {count.toLocaleString()}개</span>}
          {status === 'error' && <span className="label-error">연결 오류</span>}
        </div>
      </div>
      {board.length > 0 && <Board board={board} count={count} />}
    </div>
  )
}

function LoadTest() {
  const [n, setN] = useState('12')
  const [reqCount, setReqCount] = useState('')
  const [reqs, setReqs] = useState([])
  const [running, setRunning] = useState(false)
  const esRefs = useRef([])
  const getPodColor = usePodColors()

  const stopAll = useCallback(() => {
    esRefs.current.forEach(es => es?.close())
    esRefs.current = []
    setRunning(false)
  }, [])

  const startTest = useCallback(() => {
    stopAll()
    const parsed = parseInt(n, 10)
    if (!parsed || parsed < 1 || parsed > 20) return
    const cnt = Math.max(1, Math.min(40, parseInt(reqCount) || 1))
    const initial = Array.from({ length: cnt }, (_, i) => ({
      id: i + 1, pod: null, version: null, status: 'connecting', count: 0
    }))
    setReqs(initial)
    setRunning(true)

    const doneIds = new Set()
    esRefs.current = initial.map(req => {
      const es = new EventSource(`/api/nqueens?n=${parsed}`)
      es.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'done') {
          doneIds.add(req.id)
          es.close()
        }
        setReqs(prev => prev.map(r => {
          if (r.id !== req.id) return r
          if (msg.type === 'info') return { ...r, pod: msg.pod, version: msg.version, status: 'running' }
          if (msg.type === 'solution' || msg.type === 'progress') return { ...r, count: msg.count }
          if (msg.type === 'done') return { ...r, count: msg.total, status: 'done' }
          return r
        }))
      }
      es.onerror = () => {
        setTimeout(() => {
          if (!doneIds.has(req.id)) {
            setReqs(prev => prev.map(r => r.id === req.id ? { ...r, status: 'error' } : r))
          }
        }, 100)
        es.close()
      }
      return es
    })
  }, [n, reqCount, stopAll])

  useEffect(() => {
    if (reqs.length > 0 && reqs.every(r => r.status === 'done' || r.status === 'error')) {
      setRunning(false)
    }
  }, [reqs])

  useEffect(() => () => stopAll(), [stopAll])

  const podDist = reqs.reduce((acc, r) => {
    if (r.pod) acc[r.pod] = (acc[r.pod] || 0) + 1
    return acc
  }, {})

  return (
    <div className="tab-content">
      <div className="controls">
        <label className="n-input">
          <span>N =</span>
          <input type="number" value={n} min={1} max={20}
            disabled={running} onChange={e => setN(e.target.value)} />
        </label>
        <label className="n-input">
          <span>요청 수 =</span>
          <input type="number" value={reqCount} min={1} max={40}
            disabled={running} onChange={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v)) setReqCount(Math.min(40, Math.max(1, v)))
              else setReqCount('')
            }} />
        </label>
        <button className="btn btn-start" onClick={startTest} disabled={running}>동시 요청 시작</button>
        {running && <button className="btn btn-stop" onClick={stopAll}>중지</button>}
      </div>

      {reqs.length > 0 && (
        <>
          <table className="req-table">
            <thead>
              <tr><th>#</th><th>Pod</th><th>버전</th><th>상태</th><th>해 발견</th></tr>
            </thead>
            <tbody>
              {reqs.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {r.pod ? (
                      <span className="pod-chip" title={r.pod}
                        style={{ background: getPodColor(r.pod) + '22', color: getPodColor(r.pod), borderColor: getPodColor(r.pod) + '66' }}>
                        {shortPod(r.pod)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{r.version ? <span className={`version-badge version-${r.version}`}>{r.version}</span> : '—'}</td>
                  <td>
                    <span className={`req-status status-${r.status}`}>
                      {r.status === 'connecting' ? '연결중' : r.status === 'running' ? '진행중' : r.status === 'done' ? '완료' : '오류'}
                    </span>
                  </td>
                  <td className="count-cell">{r.count > 0 ? r.count.toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {Object.keys(podDist).length > 0 && (
            <div className="pod-dist">
              <span className="pod-dist-label">Pod 분산</span>
              {Object.entries(podDist).map(([pod, cnt]) => (
                <span key={pod} className="pod-dist-item"
                  style={{ background: getPodColor(pod) + '22', color: getPodColor(pod), borderColor: getPodColor(pod) + '66' }}>
                  {shortPod(pod)} × {cnt}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function NQueensView() {
  const [tab, setTab] = useState('single')
  return (
    <div className="container">
      <header className="header">
        <h1>N-Queens</h1>
        <p className="subtitle">GDGOC CI/CD Demo</p>
      </header>
      <div className="tabs">
        <button className={`tab-btn${tab === 'single' ? ' active' : ''}`} onClick={() => setTab('single')}>
          단일 요청
        </button>
        <button className={`tab-btn${tab === 'loadtest' ? ' active' : ''}`} onClick={() => setTab('loadtest')}>
          부하 분산 테스트
        </button>
      </div>
      {tab === 'single' ? <SingleRequest /> : <LoadTest />}
    </div>
  )
}
