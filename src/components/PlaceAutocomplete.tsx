import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { searchPlaces } from '../api/geocoding';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Place } from '../types';

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onValueChange: (value: string, selectedPlace: Place | null) => void;
}

export function PlaceAutocomplete({
  label,
  value,
  placeholder,
  required,
  onValueChange,
}: Props) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const debouncedQuery = useDebouncedValue(value, 400);
  const containerRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (!hasUserTyped) return;
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    searchPlaces(debouncedQuery, 5, controller.signal)
      .then((results) => {
        setSuggestions(results);
        setHighlight(-1);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setSuggestions([]);
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [debouncedQuery, hasUserTyped]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handlePick(place: Place) {
    onValueChange(place.displayName, place);
    setIsOpen(false);
    setSuggestions([]);
    setHasUserTyped(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      handlePick(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <label className="autocomplete" ref={containerRef}>
      {label}
      <input
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => {
          onValueChange(e.target.value, null);
          setHasUserTyped(true);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <ul className="autocomplete-list">
          {isLoading && suggestions.length === 0 && (
            <li className="autocomplete-empty">Поиск…</li>
          )}
          {suggestions.map((place, i) => (
            <li
              key={`${place.lat}-${place.lon}-${i}`}
              className={i === highlight ? 'highlighted' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(place);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {place.displayName}
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
