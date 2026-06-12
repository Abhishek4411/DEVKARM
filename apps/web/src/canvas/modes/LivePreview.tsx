import { Terminal, Globe } from 'lucide-react';
import './LivePreview.css';

interface LivePreviewProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  loading: boolean;
  serverUrl?: string;
  onClose?: () => void;
}

export default function LivePreview({ stdout, stderr, exitCode, durationMs, loading, serverUrl, onClose }: LivePreviewProps) {
  return (
    <div className="pane live-preview-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="preview-header">
        <Terminal size={14} className="preview-icon" />
        <span>Live Preview Console</span>
        {durationMs !== null && !loading && (
          <span className="preview-duration">{Math.round(durationMs)}ms</span>
        )}
        {onClose && (
          <button className="preview-close-btn" onClick={onClose} title="Close Preview">
            X
          </button>
        )}
      </div>
      
      <div className="preview-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div className="preview-loading">Running container in Sandbox...</div>
        ) : (
          <>
            {/* Console Output */}
            <div className="preview-section console-section" style={{ flexShrink: 0, overflowY: 'auto', maxHeight: '50%' }}>
              <div className="console-header">Process Output (Exit Code: {exitCode ?? '?'})</div>
              {stdout && <pre className="console-stdout">{stdout}</pre>}
              {stderr && <pre className="console-stderr">{stderr}</pre>}
              {!stdout && !stderr && !loading && (
                <div className="console-empty">No output to display</div>
              )}
            </div>

            {/* Iframe Placeholder if running a server */}
            <div className="preview-section web-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="console-header"><Globe size={12} style={{ display: 'inline', marginRight: 4 }} color="#000" /> Web View</div>
              {serverUrl ? (
                <iframe src={serverUrl} className="web-iframe" title="Web View" style={{ flex: 1, width: '100%', background: '#fff', border: 'none' }} />
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
