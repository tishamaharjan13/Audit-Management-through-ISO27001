import React from "react";
import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "../utils/password";

export default function PasswordChecklist({ password }) {
  return (
    <ul className="space-y-1 text-[11px]">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li
            key={r.id}
            className={`flex items-center space-x-1.5 ${ok ? "text-emerald-400" : "text-slate-500"}`}
          >
            {ok ? (
              <Check className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            <span>{r.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
