export function StreamingIndicator() {
  return (
    <div
      data-testid="streaming-indicator"
      style={{
        alignSelf: 'flex-start',
        display: 'flex',
        gap: 4,
        padding: '4px 10px',
        marginBottom: 6,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#00000060',
            animation: `jideBlink 1.4s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
