"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface UserSuggestion {
  email: string;
  name: string | null;
  image: string | null;
}

interface ParticipantInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  required?: boolean;
}

export default function ParticipantInput({
  emails,
  onChange,
  placeholder = "Type a name or email...",
  required = false,
}: ParticipantInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      abortRef.current?.abort();
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const users: UserSuggestion[] = await res.json();
          setSuggestions(users.filter((u) => !emails.includes(u.email)));
          setShowSuggestions(true);
          setHighlightedIndex(-1);
        }
      } catch {
        // aborted or network error — ignore
      }
    },
    [emails]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(inputValue), 200);
    return () => clearTimeout(timer);
  }, [inputValue, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addEmail = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (normalized && !emails.includes(normalized)) {
      onChange([...emails, normalized]);
    }
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
  };

  const commitInput = () => {
    const parts = inputValue.split(/[,;\s]+/).filter(Boolean);
    const newEmails = parts
      .map((p) => p.trim().toLowerCase())
      .filter((e) => e.includes("@") && !emails.includes(e));
    if (newEmails.length > 0) {
      onChange([...emails, ...newEmails]);
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          i < suggestions.length - 1 ? i + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          i > 0 ? i - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        addEmail(suggestions[highlightedIndex].email);
        return;
      }
    }

    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commitInput();
    }

    if (e.key === "Backspace" && inputValue === "" && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap gap-1.5 px-3 py-2 border border-stone-300 rounded-lg focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary bg-white min-h-[42px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-md"
          >
            {email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(email);
              }}
              className="text-primary/60 hover:text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => commitInput(), 150);
          }}
          placeholder={emails.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[140px] outline-none text-sm bg-transparent"
        />
        {/* Hidden input for form validation */}
        {required && (
          <input
            type="text"
            required
            value={emails.length > 0 ? "valid" : ""}
            onChange={() => {}}
            className="sr-only"
            tabIndex={-1}
          />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((user, index) => (
            <button
              key={user.email}
              type="button"
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                index === highlightedIndex
                  ? "bg-primary/10"
                  : "hover:bg-stone-50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addEmail(user.email);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-6 h-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-xs text-stone-500">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {user.name && (
                  <div className="text-sm font-medium text-stone-800 truncate">
                    {user.name}
                  </div>
                )}
                <div className="text-xs text-stone-500 truncate">
                  {user.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
