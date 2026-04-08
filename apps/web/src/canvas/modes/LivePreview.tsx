import { Terminal, Globe } from 'lucide-react';
import './LivePreview.css';

interface LivePreviewProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  loading: boolean;
  serverUrl?: string;
}

export default function LivePreview({ stdout, stderr, exitCode, durationMs, loading, serverUrl }: LivePreviewProps) {
  return (
    <div className="pane live-preview-pane">
      <div className="preview-header">
        <Terminal size={14} className="preview-icon" />
        <span>Live Preview Console</span>
        {durationMs !== null && !loading && (
          <span className="preview-duration">{Math.round(durationMs)}ms</span>
        )}
      </div>
      
      <div className="preview-content">
        {loading ? (
          <div className="preview-loading">Running container in Sandbox...</div>
        ) : (
          <>
            {/* Console Output */}
            <div className="preview-section console-section">
              <div className="console-header">Process Output (Exit Code: {exitCode ?? '?'})</div>
              {stdout && <pre className="console-stdout">{stdout}</pre>}
              {stderr && <pre className="console-stderr">{stderr}</pre>}
              {!stdout && !stderr && !loading && (
                <div className="console-empty">No output to display</div>
              )}
            </div>

            {/* Iframe Placeholder if running a server */}
            <div className="preview-section web-section">
              <div className="console-header"><Globe size={12} style={{ display: 'inline', marginRight: 4 }} color="#000" /> Web View</div>
              {serverUrl ? (
                <iframe src={serverUrl} className="web-iframe" title="Web View" style={{ width: '100%', height: '300px', background: '#fff', border: 'none' }} />
              ) : (
                <div className="web-empty">Waiting for a web server to bind to port 3000...</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
