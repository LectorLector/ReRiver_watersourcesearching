'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

interface SearchableSelectProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  label: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  label
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option: string) => {
    onChange(option)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3.5 text-left bg-white border border-gray-200 rounded-xl 
          transition-all duration-200 flex items-center justify-between
          ${disabled 
            ? 'opacity-50 cursor-not-allowed bg-gray-50' 
            : 'hover:border-cyan-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent'
          }`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg 
                  bg-white text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(option)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors duration-150
                    ${value === option ? 'bg-cyan-50 text-cyan-600' : 'text-gray-900'}
                  `}
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-400">
                無符合結果
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
