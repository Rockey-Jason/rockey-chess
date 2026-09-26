import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

import "./Login.css";

export default function Login() {

    const navigate = useNavigate();

    const [name, setName] = useState("");

    const [loginId, setLoginId] = useState("");

    const [email, setEmail] = useState("");

    const [password, setPassword] = useState("");

    async function login() {

        if (
            !name ||
            !loginId ||
            !email ||
            !password
        ) {

            alert("모든 정보를 입력하세요.");

            return;

        }

        const { data, error } =
        await supabase.functions.invoke(

            "super-worker",

            {

                body:{

                    name,

                    loginId,

                    email,

                    password

                }

            }

        );

        if(error){

            alert(error.message);

            return;

        }

        if(!data.success){

            alert(data.message);

            return;

        }

        const {

            error:loginError

        } =

        await supabase.auth.signInWithPassword({

            email,

            password

        });

        if(loginError){

            alert(loginError.message);

            return;

        }

        alert("로그인 성공!");

        navigate("/chess");

    }

return (

    <div className="loginPage">

        <h1 className="title">
            돌이 사이트
        </h1>

        <p className="subTitle">
            로그인-이미 만든 계정에 가입해 돌이사이트의 기능들을 이용해보세요!
        </p>

        <div className="inputArea">

            <div className="inputBox">

                <div className="label">
                    계정 이름
                </div>

                <input
                    value={name}
                    onChange={(e)=>setName(e.target.value)}
                    placeholder="계정 이름을 입력하세요"
                />

            </div>

            <div className="inputBox">

                <div className="label">
                    아이디
                </div>

                <input
                    value={loginId}
                    onChange={(e)=>setLoginId(e.target.value)}
                    placeholder="아이디를 입력하세요"
                />

            </div>

            <div className="inputBox">

                <div className="label">
                    비밀번호
                </div>

                <input
                    type="password"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                />

            </div>

            <div className="inputBox">

                <div className="label">
                    이메일
                </div>

                <input
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                    placeholder="이메일을 입력하세요"
                />

            </div>

        </div>

        <button
            className="loginButton"
            onClick={login}
        >
            로그인
        </button>

    </div>

);
}