"use client";

const nodes = [
  { id: "lead", label: "Lead Input", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", x: 100, y: 100 },
  { id: "ai", label: "AI Analysis", icon: "M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zM8 14v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4", x: 350, y: 80 },
  { id: "call", label: "Voice Call", icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z", x: 600, y: 100 },
  { id: "sentiment", label: "Sentiment", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01", x: 850, y: 80 },
  { id: "email", label: "Email", icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6", x: 250, y: 280 },
  { id: "whatsapp", label: "WhatsApp", icon: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z", x: 550, y: 300 },
  { id: "meeting", label: "Meeting Booked", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4", x: 800, y: 280 },
];

const edges = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 6 },
];

function getEdgePath(fromNode: typeof nodes[0], toNode: typeof nodes[0]) {
  const x1 = fromNode.x + 60;
  const y1 = fromNode.y + 30;
  const x2 = toNode.x + 60;
  const y2 = toNode.y + 30;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export default function WorkflowAnimation() {
  return (
    <svg
      viewBox="0 0 1000 400"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="particleGlow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.78  0 0 0 0 1  0 0 0 0 0  0 0 0 0.3 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {edges.map((edge, i) => {
        const d = getEdgePath(nodes[edge.from], nodes[edge.to]);
        return (
          <g key={`edge-${i}`}>
            {/* Base path */}
            <path
              d={d}
              fill="none"
              stroke="rgba(0,24,255,0.12)"
              strokeWidth="1.5"
            />
            {/* Animated flowing path */}
            <path
              d={d}
              fill="none"
              stroke="rgba(0,24,255,0.35)"
              strokeWidth="1.5"
              strokeDasharray="8 16"
              className="animate-flow"
            />
            {/* Data particles */}
            {[0, 1, 2].map((p) => (
              <circle
                key={p}
                r="2.5"
                fill="#0018FF"
                filter="url(#particleGlow)"
                opacity="0.8"
              >
                <animateMotion
                  dur={`${3 + p * 0.5}s`}
                  repeatCount="indefinite"
                  begin={`${p * 1}s`}
                >
                  <mpath href={`#edge-path-${i}`} />
                </animateMotion>
              </circle>
            ))}
            {/* Hidden path for animateMotion reference */}
            <path id={`edge-path-${i}`} d={d} fill="none" stroke="none" />
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g
          key={node.id}
          className="animate-nodeIn"
          style={{ animationDelay: `${i * 0.12}s` }}
        >
          {/* Glow behind node */}
          <rect
            x={node.x}
            y={node.y}
            width="120"
            height="60"
            rx="12"
            fill="rgba(0,24,255,0.03)"
            filter="url(#nodeGlow)"
            className="animate-nodePulse"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
          {/* Node background */}
          <rect
            x={node.x}
            y={node.y}
            width="120"
            height="60"
            rx="12"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          {/* Icon */}
          <g transform={`translate(${node.x + 48}, ${node.y + 10})`}>
            <path
              d={node.icon}
              fill="none"
              stroke="#0018FF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="scale(0.85)"
              opacity="0.8"
            />
          </g>
          {/* Label */}
          <text
            x={node.x + 60}
            y={node.y + 50}
            textAnchor="middle"
            fill="rgba(250,250,250,0.7)"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
          >
            {node.label}
          </text>
        </g>
      ))}

      <style>{`
        @keyframes flowDash {
          to { stroke-dashoffset: -48; }
        }
        @keyframes nodeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes nodePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-flow {
          animation: flowDash 2s linear infinite;
        }
        .animate-nodeIn {
          animation: nodeIn 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-nodePulse {
          animation: nodePulse 3s ease-in-out infinite;
        }
      `}</style>
    </svg>
  );
}
