export function App() {
  return (
    <main
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1
        data-testid="wordmark"
        style={{
          fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
          fontSize: 96,
          letterSpacing: -2,
          color: 'var(--jide-accent)',
          margin: 0,
        }}
      >
        jide
      </h1>
    </main>
  );
}
