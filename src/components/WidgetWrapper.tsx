import React from 'react';

interface Props {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  widgetId?: string;
  onRemove?: () => void;
  style?: React.CSSProperties;
}

export default function WidgetWrapper({ title, icon, children, widgetId, onRemove, style }: Props) {
  return (
    <div className={`widget-wrapper ${widgetId ? `widget-${widgetId}` : ''}`} style={style}>
      <div className="widget-header">
        <div className="widget-title">
          {icon}
          <span>{title}</span>
        </div>
        {onRemove && (
          <button className="widget-close" onClick={onRemove} title="Widget entfernen">
            &times;
          </button>
        )}
      </div>
      <div className="widget-content">
        {children}
      </div>
    </div>
  );
}
