#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
node bin/agy-zh.mjs auto-disable
result=$?
read -r '?按回车关闭窗口。'
exit $result
