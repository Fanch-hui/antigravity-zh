#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
node bin/agy-zh.mjs auto-enable
result=$?
if (( result != 0 )); then
  printf '\n自动汉化未能启用，请查看上面的错误。\n'
fi
read -r '?按回车关闭窗口。'
exit $result
