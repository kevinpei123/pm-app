"use client";

import { FormHTMLAttributes } from "react";

type ConfirmFormProps = FormHTMLAttributes<HTMLFormElement> & {
  message: string;
};

export default function ConfirmForm({ message, onSubmit, ...props }: ConfirmFormProps) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!confirm(message)) {
          event.preventDefault();
          return;
        }
        onSubmit?.(event);
      }}
    />
  );
}
