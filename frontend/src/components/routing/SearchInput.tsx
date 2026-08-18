import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Place } from "../../types/index.js";
import { usePlaceSearch } from "../../hooks/usePlaceSearch.js";
import { Spinner } from "../ui.js";

export function SearchInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { results, searching } = usePlaceSearch(query);
  const listboxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = `search-${label.replace(/\W+/g, "-").toLowerCase()}`;

  useEffect(() => {
    if (value) setQuery(value.label);
  }, [value]);

  const selectPlace = (place: Place) => {
    onChange(place);
    setQuery(place.label);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (active >= 0 && results[active]) selectPlace(results[active]!);
        break;
      case "Escape":
        setOpen(false);
        inputRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const suggestions = results.length > 0 ? results : [];

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ash">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-input border border-graphite bg-charcoal py-3 pl-11 pr-4 text-base text-silk placeholder:text-ash focus:border-link-blue"
        />
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <Spinner label="" />
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          ref={listboxRef}
          id={`${id}-listbox`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-card-sm border border-graphite bg-charcoal"
        >
          {suggestions.map((place, i) => (
            <li
              key={place.id}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPlace(place);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-3 ${
                i === active ? "bg-smoke" : "hover:bg-smoke"
              }`}
            >
              <div className="text-sm font-medium text-silk">{place.label}</div>
              <div className="truncate text-xs text-ash">{place.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}