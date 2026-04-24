import { useState, useRef, useCallback, useEffect } from 'react'

export default function NQueensView() {
  const [n, setN] = useState('12')
  const [board, setBoard] = useState([])
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('idle')   // idle | running | done | error
  const [podInfo, setPodInfo] = useState(null)
  const esRef = useRef(null)

  const start = useCallback(() => {
    const parsed = parseInt(n, 10)
    if (!parsed || parsed < 1 || parsed > 20) return

    esRef.current?.close()
    setBoard([])
    setCount(0)
    setStatus('running')
    setPodInfo(null)

    const es = new EventSource(`/api/nqueens?n=${parsed}`)
    esRef.current = es

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'info') {
        setPodInfo({ pod: msg.pod, version: msg.version })
      }

      if (msg.type === 'solution') {
        setBoard(msg.board)
        setCount(msg.count)
      }

      if (msg.type === 'progress') {
        setCount(msg.count)
      }

      if (msg.type === 'done') {
        setCount(msg.total)
        setStatus('done')
        es.close()
      }
    }

    es.onerror = () => {
      setStatus('error')
      es.close()
    }
  }, [n])

  const stop = useCallback(() => {
    esRef.current?.close()
    setStatus('idle')
  }, [])

  useEffect(() => () => esRef.current?.close(), [])

  const parsed = parseInt(n, 10) || 0

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>N-Queens</h1>
          <p className="subtitle">GDGOC CI/CD Demo</p>
        </div>
        {podInfo && (
          <div className="pod-info">
            <span className="pod-label">Pod</span>
            <span className="pod-name">{podInfo.pod}</span>
            <span className={`version-badge version-${podInfo.version}`}>
              {podInfo.version}
            </span>
          </div>
        )}
      </header>

      <div className="controls">
        <label className="n-input">
          <span>N =</span>
          <input
            type="number"
            value={n}
            min={1}
            max={20}
            disabled={status === 'running'}
            onChange={e => setN(e.target.value)}
          />
        </label>

        <button
          className="btn btn-start"
          onClick={start}
          disabled={status === 'running'}
        >
          시작
        </button>

        <div className="stats">
          {status === 'running' && <span className="label-active">진행중...</span>}
          {count > 0 && <span>해 발견: <strong>{count.toLocaleString()}</strong>개</span>}
          {status === 'done' && <span className="label-done">완료! 총 {count.toLocaleString()}개</span>}
          {status === 'error' && <span className="label-error">연결 오류</span>}
        </div>
      </div>

      {board.length > 0 && (
        <div className="board-wrap">
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${board.length}, 1fr)` }}
          >
            {Array.from({ length: board.length }, (_, row) =>
              Array.from({ length: board.length }, (_, col) => {
                const isLight = (row + col) % 2 === 0
                const hasQueen = board[row] === col
                return (
                  <div
                    key={`${row}-${col}`}
                    className={`cell ${isLight ? 'light' : 'dark'}`}
                  >
                    {hasQueen && <span className="queen">♛</span>}
                  </div>
                )
              })
            )}
          </div>
          {parsed > 0 && (
            <p className="board-label">{board.length}-Queens 해 #{count.toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  )
}
