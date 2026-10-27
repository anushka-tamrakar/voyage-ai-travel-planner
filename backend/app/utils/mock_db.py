from typing import Any, Dict, List, Optional


class MockResponse:
    def __init__(self, data: Any):
        self.data = data


class MockQuery:
    def __init__(self, table_name: str, db: Dict[str, List[Dict[str, Any]]]):
        self.table_name = table_name
        self.db = db
        self.filters = []
        self.order_by = None
        self.order_desc = False
        self.limit_count = None
        self.pending_insert = None
        self.pending_update = None
        self.is_delete = False

    def select(self, columns: str = "*"):
        return self

    def insert(self, record: Any):
        if isinstance(record, dict):
            self.pending_insert = [record.copy()]
        elif isinstance(record, list):
            self.pending_insert = [r.copy() for r in record]
        return self

    def update(self, updates: Dict[str, Any]):
        self.pending_update = updates
        return self

    def delete(self):
        self.is_delete = True
        return self

    def eq(self, column: str, value: Any):
        self.filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self.order_by = column
        self.order_desc = desc
        return self

    def limit(self, count: int):
        self.limit_count = count
        return self

    def execute(self) -> MockResponse:
        rows = self.db.setdefault(self.table_name, [])

        if self.pending_insert is not None:
            for r in self.pending_insert:
                rows.append(r)
            return MockResponse(self.pending_insert)

        if self.is_delete:
            remaining = []
            deleted = []
            for r in rows:
                match = all(str(r.get(col, "")).lower() == str(val).lower() for col, val in self.filters)
                if match:
                    deleted.append(r)
                else:
                    remaining.append(r)
            self.db[self.table_name] = remaining
            return MockResponse(deleted)

        if self.pending_update is not None:
            updated = []
            for r in rows:
                match = all(str(r.get(col, "")).lower() == str(val).lower() for col, val in self.filters)
                if match:
                    r.update(self.pending_update)
                    updated.append(r.copy())
            return MockResponse(updated)

        # Query select
        results = []
        for r in rows:
            match = all(str(r.get(col, "")).lower() == str(val).lower() for col, val in self.filters)
            if match:
                results.append(r.copy())

        if self.order_by:
            results.sort(key=lambda x: str(x.get(self.order_by, "")), reverse=self.order_desc)

        if self.limit_count is not None:
            results = results[: self.limit_count]

        return MockResponse(results)


class MockSupabaseClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.db = {
                "users": [],
                "trips": [],
                "itineraries": [],
            }
        return cls._instance

    def table(self, name: str) -> MockQuery:
        return MockQuery(name, self.db)
