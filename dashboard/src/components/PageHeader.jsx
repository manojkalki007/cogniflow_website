export default function PageHeader({ title, description, action, icon: Icon }) {
  return (
    <div
      className="flex items-start justify-between px-6 lg:px-8 pt-6 pb-5"
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--accent-subtle)",
              border: "1px solid rgba(34,211,238,0.1)",
            }}
          >
            <Icon size={16} style={{ color: "var(--accent)" }} />
          </div>
        )}
        <div className="min-w-0">
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="text-[13px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}
