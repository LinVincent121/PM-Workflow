import { test, expect } from '@playwright/test';

test('首页可打开并展示登录注册入口', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PM Workbench/i);
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  await expect(page.getByRole('button', { name: /注册/ })).toBeVisible();
});

test('登录弹窗点击外部不会关闭', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('新建任务页展示推荐工作流', async ({ page }) => {
  await page.goto('/chat');
  await expect(page.getByText('推荐工作流')).toBeVisible();
  await expect(page.getByText('产品想法完善')).toBeVisible();
});

test('文件列表接口未登录时只返回公开的空列表', async ({ request }) => {
  const response = await request.get('/api/files');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
});

test('可选的已登录核心流程', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, '设置 E2E_EMAIL/E2E_PASSWORD 后运行已登录流程');
  await page.goto('/auth');
  await page.getByLabel('邮箱').fill(process.env.E2E_EMAIL!);
  await page.getByLabel('密码').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/chat');
  await expect(page.getByText('新建任务')).toBeVisible();
});
