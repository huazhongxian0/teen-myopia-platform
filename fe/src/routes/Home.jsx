import { useAccount } from '../hooks/useAccount.js'
import ManagerPage from './ManagerPage/index.jsx'
import DoctorPage from './DoctorPage/index.jsx'
import TeacherPage from './TeacherPage/index.jsx'
import StudentPage from './StudentPage/index.jsx'

/**
 * 首页入口组件 - 根据权限显示对应端的页面
 * @param {Object} props - 组件属性
 * @param {Function} props.onLogout - 退出登录回调函数
 */
export default function Home({ onLogout }) {
  const { hasAuthCode } = useAccount()
  console.log(useAccount(),hasAuthCode('student'))
  if (hasAuthCode('manager_page')) {
    return <ManagerPage onLogout={onLogout} />
  }

  if (hasAuthCode('doctor_page')) {
    return <DoctorPage onLogout={onLogout} />
  }

  if (hasAuthCode('teacher_page')) {
    return <TeacherPage onLogout={onLogout} />
  }

  if (hasAuthCode('student_page')) {
    return <StudentPage onLogout={onLogout} />
  }

  return <ManagerPage onLogout={onLogout} />
}
