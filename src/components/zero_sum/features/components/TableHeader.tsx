interface TableHeaderProps {
  headings: string[];
}

export const TableHeader = ({ headings }: TableHeaderProps): JSX.Element => (
  <thead className="bg-gray-50">
    <tr>
      {headings.map((label) => (
        <th
          key={label}
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
        >
          {label}
        </th>
      ))}
    </tr>
  </thead>
);
