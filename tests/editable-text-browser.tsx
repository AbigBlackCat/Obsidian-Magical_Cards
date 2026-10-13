import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import EditableText from '../src/EditableText';

// Browser-only fixture: editing and saving never touches a vault or plugin configuration.
function Fixture() {
  const [value, setValue] = useState('原模块');
  const [saves, setSaves] = useState<string[]>([]);
  return <main>
    <h1>标题粘贴、撤销与输入法验收</h1>
    <p>点击标题编辑，粘贴带格式文字后使用系统撤销／重做，再按 Enter 保存。所有内容仅保存在此页内存中。</p>
    <EditableText as="h2" ariaLabel="验收标题" value={value} onSave={async next => {
      setValue(next); setSaves(previous => [...previous, next]); return true;
    }}/>
    <button>离开编辑</button>
    <output aria-label="保存记录">{JSON.stringify(saves)}</output>
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing browser fixture root');
createRoot(root).render(<Fixture/>);
