#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  print '请先安装 Node.js 22，再运行汉化入口。'
  read -r '?按回车关闭'
  exit 1
fi
node bin/agy-zh.mjs launch
result=$?
if (( result != 0 )); then read -r '?按回车关闭'; fi
exit $result
