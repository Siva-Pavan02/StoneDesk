import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Field } from "./Controls";

export default function ProductPriceDialog({
  product,
  onSave,
  onCancel,
}) {
  const dialog = useRef(null);
  const id = useId();
  const [price, setPrice] = useState(() => String(product?.ratePerSqFt ?? ""));
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function submit(event) {
    event.preventDefault();
    const value = Number(String(price).trim());
    if (!String(price).trim() || !Number.isFinite(value) || value < 0) {
      setPriceError("Enter a price of 0 or more");
      dialog.current?.querySelector('input[name="productPrice"]')?.focus();
      return;
    }
    const error = onSave(value);
    if (error) setPriceError(error);
  }

  const unit = product?.rateUnit === "UNIT";
  return (
    <dialog
      ref={dialog}
      className="app-dialog pilot product-price-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-product ${id}-scope`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form onSubmit={submit} noValidate>
        <div className="product-price-dialog-body">
          <h2 id={`${id}-title`}>Edit invoice price</h2>
          <p id={`${id}-product`} className="product-price-dialog-product">
            {product?.stoneType}
            {product?.finish ? ` · ${product.finish}` : ""}
            {product?.category === "TOP" ? " · Top" : ""}
          </p>
          <p id={`${id}-scope`} className="product-price-dialog-product">Only this group in this invoice will change.</p>
          <Field
            label={unit ? "Price per unit (₹)" : "Price per sq ft (₹)"}
            name="productPrice"
            type="number"
            min="0"
            step="any"
            required
            autoFocus
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              setPriceError("");
            }}
            error={priceError}
          />
        </div>
        <div className="product-price-dialog-actions">
          <Button label="Cancel" onClick={onCancel} />
          <Button primary type="submit" label="Apply price" />
        </div>
      </form>
    </dialog>
  );
}
