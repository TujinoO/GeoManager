import {
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Alert, Button, DatePicker, Input, Select, Typography } from "antd";
import dayjs from "dayjs";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AttributeFilter, DataResourceProfile } from "../types";

type QueryOutcome = {
  totalCount: number;
  returnedCount: number;
  limitExceeded: boolean;
};
export type AttributeQuerySubmit = (
  filters: AttributeFilter[],
) => Promise<QueryOutcome | null> | void;
type Draft = {
  id: string;
  field?: string;
  operator: AttributeFilter["operator"];
  value: string;
  valueTo?: string;
};

const operatorLabels = {
  contains: "map.contains",
  eq: "map.equals",
  ne: "map.notEquals",
  gt: "map.greaterThan",
  gte: "map.greaterThanOrEqual",
  lt: "map.lessThan",
  lte: "map.lessThanOrEqual",
  between: "map.between",
} as const;

function operators(type?: string): AttributeFilter["operator"][] {
  if (type === "number" || type === "datetime")
    return ["eq", "ne", "gt", "gte", "lt", "lte", "between"];
  if (type === "boolean") return ["eq", "ne"];
  return ["contains", "eq", "ne"];
}

const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function numericValue(value: string) {
  const normalized = value.trim().replace(/,/g, "");
  const number = Number(normalized);
  return numericPattern.test(normalized) && Number.isFinite(number)
    ? number
    : null;
}

function blank(id: string): Draft {
  return { id, operator: "contains", value: "" };
}

export default function AttributeQueryForm({
  fields,
  querying,
  onSubmit,
}: {
  fields: DataResourceProfile["fields"];
  querying: boolean;
  onSubmit: AttributeQuerySubmit;
}) {
  const { t } = useTranslation();
  const nextId = useRef(1);
  const submitting = useRef(false);
  const [rows, setRows] = useState([blank("0")]);
  const [validation, setValidation] = useState<{
    key: string;
    row: string;
    number: number;
  } | null>(null);
  const [outcome, setOutcome] = useState<QueryOutcome | null>(null);
  const fieldOptions = fields.map(({ name, description }) => ({
    value: name,
    label:
      description && description !== name ? `${description} (${name})` : name,
  }));

  function edit(updater: (current: Draft[]) => Draft[]) {
    setRows(updater);
    setValidation(null);
    setOutcome(null);
  }

  function update(id: string, changes: Partial<Draft>) {
    edit((current) =>
      current.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  }

  async function submit() {
    if (querying || submitting.current) return;
    setOutcome(null);
    const filters: AttributeFilter[] = [];
    for (const [index, row] of rows.entries()) {
      const field = fields.find(({ name }) => name === row.field);
      const value = row.value.trim();
      const valueTo =
        row.operator === "between" ? row.valueTo?.trim() : undefined;
      let error: string | undefined;
      if (!field || !value || (row.operator === "between" && !valueTo)) {
        error = "map.attributeQueryIncomplete";
      } else if (field.type === "number") {
        const low = numericValue(value);
        const high = valueTo ? numericValue(valueTo) : null;
        if (low === null || (valueTo && high === null))
          error = "map.attributeQueryNumber";
        else if (high !== null && low > high) error = "map.attributeQueryOrder";
      } else if (field.type === "datetime" && valueTo && value > valueTo) {
        error = "map.attributeQueryOrder";
      }
      if (!field || error) {
        setValidation({
          key: error ?? "map.attributeQueryIncomplete",
          row: row.id,
          number: index + 1,
        });
        return;
      }
      filters.push({
        id: row.id,
        field: field.name,
        operator: row.operator,
        value,
        ...(valueTo ? { valueTo } : {}),
      });
    }
    setValidation(null);
    submitting.current = true;
    try {
      const result = await onSubmit(filters);
      if (result) setOutcome(result);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form
      className="attribute-query-form"
      aria-label={t("map.attributeQuery")}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="subsection-title">
        <FilterOutlined style={{ fontSize: 15 }} />
        <Typography.Text strong>{t("map.attributeQuery")}</Typography.Text>
      </div>
      <Typography.Text type="secondary" className="attribute-query-hint">
        {t("map.attributeQueryHint")}
      </Typography.Text>
      {rows.map((row, index) => {
        const type = fields.find(({ name }) => name === row.field)?.type;
        const invalid = validation?.row === row.id;
        const label = (name: string) => `${t(name)} ${index + 1}`;
        function valueInput(end = false) {
          const inputLabel = label(
            end
              ? "map.endValue"
              : row.operator === "between"
                ? "map.attributeQueryStart"
                : "map.fieldValue",
          );
          const inputValue = (end ? row.valueTo : row.value) ?? "";
          const onChange = (value: string) =>
            update(row.id, end ? { valueTo: value } : { value });
          const common = {
            "aria-label": inputLabel,
            status: invalid ? ("error" as const) : undefined,
            disabled: querying || !row.field,
          };
          if (type === "datetime")
            return (
              <DatePicker
                {...common}
                className="full-width"
                format="YYYY-MM-DD"
                placeholder={inputLabel}
                value={inputValue ? dayjs(inputValue) : null}
                onChange={(date) => onChange(date?.format("YYYY-MM-DD") ?? "")}
              />
            );
          if (type === "boolean")
            return (
              <Select
                {...common}
                className="full-width"
                placeholder={inputLabel}
                value={inputValue || undefined}
                onChange={onChange}
                options={[
                  { value: "true", label: t("map.attributeQueryTrue") },
                  { value: "false", label: t("map.attributeQueryFalse") },
                ]}
              />
            );
          return (
            <Input
              {...common}
              placeholder={inputLabel}
              value={inputValue}
              onChange={(event) => onChange(event.target.value)}
            />
          );
        }
        return (
          <div className="attribute-query-condition" key={row.id}>
            <div className="attribute-query-field">
              <Select
                aria-label={label("map.selectField")}
                placeholder={t("map.selectField")}
                value={row.field}
                options={fieldOptions}
                showSearch
                optionFilterProp="label"
                disabled={querying}
                onChange={(name) => {
                  const type = fields.find(
                    (field) => field.name === name,
                  )?.type;
                  update(row.id, {
                    field: name,
                    operator: operators(type)[0],
                    value: "",
                    valueTo: undefined,
                  });
                }}
              />
              {rows.length > 1 && (
                <Button
                  aria-label={label("map.attributeQueryRemove")}
                  icon={<DeleteOutlined />}
                  disabled={querying}
                  onClick={() =>
                    edit((current) => current.filter(({ id }) => id !== row.id))
                  }
                />
              )}
            </div>
            <Select
              aria-label={label("map.attributeQueryOperator")}
              value={row.operator}
              disabled={querying || !row.field}
              options={operators(type).map((value) => ({
                value,
                label: t(operatorLabels[value]),
              }))}
              onChange={(operator) =>
                update(row.id, { operator, valueTo: undefined })
              }
            />
            {valueInput()}
            {row.operator === "between" && valueInput(true)}
          </div>
        );
      })}
      {validation && (
        <Alert
          type="error"
          title={t(validation.key, { row: validation.number })}
          showIcon
        />
      )}
      <div className="attribute-action-row">
        <Button
          icon={<PlusOutlined aria-hidden />}
          disabled={querying}
          onClick={() => {
            const draft = blank(String(nextId.current++));
            edit((current) => [...current, draft]);
          }}
        >
          {t("map.addCondition")}
        </Button>
        <Button type="primary" htmlType="submit" loading={querying}>
          {t("map.queryAndLoad")}
        </Button>
      </div>
      {outcome && (
        <Alert
          showIcon
          type={
            outcome.returnedCount === 0 ||
            outcome.limitExceeded ||
            outcome.totalCount !== outcome.returnedCount
              ? "warning"
              : "success"
          }
          title={
            outcome.totalCount === 0
              ? t("map.attributeQueryNoMatches")
              : t("map.attributeQueryOutcome", {
                  total: outcome.totalCount,
                  returned: outcome.returnedCount,
                })
          }
          description={
            <>
              {outcome.limitExceeded ? (
                <div>{t("map.attributeQueryLimited")}</div>
              ) : outcome.totalCount > outcome.returnedCount ? (
                <div>{t("map.attributeQueryUnavailable")}</div>
              ) : null}
              {t("map.attributeQueryLayerHint")}
            </>
          }
        />
      )}
    </form>
  );
}
