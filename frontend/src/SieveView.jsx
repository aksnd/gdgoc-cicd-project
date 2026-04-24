import { useState, useRef, useCallback, useEffect } from 'react'

export default function SieveView() {
  const [n, setN] = useState('200')
  const [primes, setPrimes] = useState([])
  const [status, setStatus] = useState('idle')   // idle | running | done | error
  const [podInfo, setPodInfo] = useState(null)
  const [currentPrime, setCurrentPrime] = useState(null)
  const esRef = useRef(null)

  const start = useCallback(() => {
    esRef.current?.close()
    setPrimes([])
    setStatus('running')
    setPodInfo(null)
    setCurrentPrime(null)

    const parsed = parseInt(n, 10)
    if (!parsed || parsed < 2) return

    const es = new EventSource(`/api/sieve?n=${parsed}`)
    esRef.current = es

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'info') {
        setPodInfo({ pod: msg.pod, version: msg.version })
      }

      if (msg.type === 'step') {
        setCurrentPrime(msg.prime)
        setPrimes(prev => [...prev, msg.prime])
      }

      if (msg.type === 'done') {
        setPrimes(msg.primes)
        setStatus('done')
        setCurrentPrime(null)
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
    setCurrentPrime(null)
  }, [])

  useEffect(() => () => esRef.current?.close(), [])

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>에라토스테네스의 체</h1>
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
            min={2}
            disabled={status === 'running'}
            onChange={e => setN(e.target.value)}
          />
        </label>

        {status !== 'running'
          ? <button className="btn btn-start" onClick={start}>시작</button>
          : <button className="btn btn-stop" onClick={stop}>중지</button>
        }

        <div className="stats">
          {primes.length > 0 && (
            <span>소수: <strong>{primes.length}</strong>개</span>
          )}
          {currentPrime && (
            <span className="label-active">{currentPrime}의 배수 제거 중...</span>
          )}
          {status === 'done' && <span className="label-done">완료!</span>}
          {status === 'error' && <span className="label-error">연결 오류</span>}
        </div>
      </div>

      {primes.length > 0 && (
        <div className="prime-list">
          {primes.map(p => (
            <span key={p} className="prime-badge">{p}</span>
          ))}
        </div>
      )}
    </div>
  )
}
