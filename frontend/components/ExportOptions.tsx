interface ExportOptionsProps {
    format: 'anki' | 'csv' | 'text'
    onFormatChange: (format: 'anki' | 'csv' | 'text') => void
  }
  
  export function ExportOptions({ format, onFormatChange }: ExportOptionsProps) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Export Format</h2>
        <div className="flex space-x-4">
          {['anki', 'csv', 'text'].map((option) => (
            <label key={option} className="flex items-center space-x-2">
              <input
                type="radio"
                value={option}
                checked={format === option}
                onChange={(e) => onFormatChange(e.target.value as 'anki' | 'csv' | 'text')}
                className="text-blue-500"
              />
              <span className="capitalize">{option}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }